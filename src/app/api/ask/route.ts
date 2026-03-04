import { NextRequest, NextResponse } from "next/server";
import { handleMoFPEDQuery } from "@/lib/mofped-response-handler";

// Force Node.js runtime to avoid Edge body parsing issues on Vercel
export const runtime = "nodejs";

type SessionState = {
	messages: Array<{ role: "user" | "assistant"; text: string; ts: number }>;
};

const sessionStore = new Map<string, SessionState>();

const STOPWORDS = new Set(["the", "a", "on", "for", "is", "it"]);

function normalizeInput(input: string): string {
	const cleaned = input
		.toLowerCase()
		.replace(/[^\w\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	const tokens = cleaned
		.split(" ")
		.filter((token) => token && !STOPWORDS.has(token))
		.map((token) => {
			if (token.length > 3 && token.endsWith("s")) {
				return token.slice(0, -1);
			}
			return token;
		});

	return tokens.join(" ").trim();
}

function getSessionState(sessionId: string): SessionState {
	const existing = sessionStore.get(sessionId);
	if (existing) return existing;
	const state: SessionState = { messages: [] };
	sessionStore.set(sessionId, state);
	return state;
}

export async function POST(req: NextRequest) {
	const started = Date.now();
	try {
		// Read raw body first for debugging (body can only be consumed once)
		const rawBody = await req.text();
		let body: Record<string, unknown> = {};
		if (rawBody?.trim()) {
			try {
				body = JSON.parse(rawBody) as Record<string, unknown>;
			} catch (parseErr) {
				console.error('[API] Failed to parse request body. Raw (first 200 chars):', rawBody?.slice(0, 200));
				return NextResponse.json({
					error: "Invalid JSON body",
					summary: "Please enter a question or message.",
					response: "Please enter a question or message.",
					guardrail_status: "error",
				}, { status: 400 });
			}
		}
		if (!body || typeof body !== "object") {
			body = {};
		}
		// Support multiple body formats: message, query, prompt, text, input
		const query = (body.query ?? body.message ?? body.prompt ?? body.text ?? body.input) as string | undefined;
		const context = body.context ?? (Array.isArray(body.history) ? body.history.map((h: { role?: string; content?: string }) => h.content).filter(Boolean) : []);
		const sessionId = body.sessionId;

		if (!query || typeof query !== "string" || !query.trim()) {
			console.warn('[API] 400: Missing or empty query. Raw body length:', rawBody?.length ?? 0, 'Body keys:', Object.keys(body || {}));
			return NextResponse.json({
				error: "Query is required",
				summary: "Please enter a question or message.",
				response: "Please enter a question or message.",
				guardrail_status: "error",
			}, { status: 400 });
		}

		const normalizedQuery = normalizeInput(query);
		const incomingContext = Array.isArray(context) ? context : [];
		const normalizedContext = incomingContext
			.map((item) => (typeof item === "string" ? normalizeInput(item) : ""))
			.filter(Boolean);

		const sessionContext: string[] = [];
		if (typeof sessionId === "string" && sessionId.trim()) {
			const state = getSessionState(sessionId);
			const recentUserMessages = state.messages
				.filter((msg) => msg.role === "user")
				.slice(-4)
				.map((msg) => msg.text);
			sessionContext.push(...recentUserMessages);
		}

		const combinedContext = [...sessionContext, ...normalizedContext].slice(-4);

		console.log(`[API] Processing MoFPED query: "${query}" -> "${normalizedQuery}"`);

		// Use the new MoFPED response handler with intent routing
		const response = await handleMoFPEDQuery(normalizedQuery || query, combinedContext);

		if (typeof sessionId === "string" && sessionId.trim()) {
			const state = getSessionState(sessionId);
			state.messages.push({ role: "user", text: normalizedQuery || query, ts: Date.now() });
			if (response.summary) {
				state.messages.push({ role: "assistant", text: response.summary, ts: Date.now() });
			}
			if (state.messages.length > 20) {
				state.messages = state.messages.slice(-20);
			}
		}

		// Guarantee always return a displayable message
		const displayText = response?.summary ?? response?.response ?? "I apologize, but I encountered an error. Please try again or contact our support team.";
		return NextResponse.json({
			...response,
			response: displayText,
			summary: displayText,
			notFound: response.guardrail_status === "not_found",
			timings: { total_ms: Date.now() - started },
		});
	} catch (error) {
		console.error('[API] Error processing query:', error);
		const errMsg = error instanceof Error ? error.message : "Unknown error";
		const fallbackMsg = "I apologize, but I encountered an error while processing your request. Please try again or contact our support team.";
		return NextResponse.json({
			error: errMsg,
			summary: fallbackMsg,
			response: fallbackMsg,
			guardrail_status: "error",
			details: process.env.NODE_ENV === "development" ? errMsg : undefined,
		}, { status: 500 });
	}
}


