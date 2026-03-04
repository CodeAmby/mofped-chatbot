import { NextRequest, NextResponse } from "next/server";
import { handleMoFPEDQuery } from "@/lib/mofped-response-handler";

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
		const { query, context, sessionId } = await req.json();
		if (!query || typeof query !== "string" || !query.trim()) {
			return NextResponse.json({ error: "Query is required" }, { status: 400 });
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

		return NextResponse.json({
			...response,
			timings: { total_ms: Date.now() - started },
		});
	} catch (error) {
		console.error('[API] Error processing query:', error);
		return NextResponse.json({ 
			error: "Internal server error",
			summary: "I apologize, but I encountered an error while processing your request. Please try again or contact our support team.",
			guardrail_status: "error"
		}, { status: 500 });
	}
}


