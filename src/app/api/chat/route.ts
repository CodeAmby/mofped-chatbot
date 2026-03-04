import { NextRequest, NextResponse } from "next/server";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { getLLM, hasAIConfigured } from "@/lib/get-llm";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import { searchHybrid, selectTopWithThreshold } from "@/lib/rag";

type HistoryMessage = { role: "user" | "assistant"; content: string };

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

function mapHistory(history: HistoryMessage[]): Array<HumanMessage | AIMessage> {
	return history.map((item) => {
		if (item.role === "assistant") {
			return new AIMessage(item.content);
		}
		return new HumanMessage(item.content);
	});
}

class HybridRetriever extends BaseRetriever {
	lc_namespace = ["mofped", "retriever"];
	private k: number;

	constructor(k = 5) {
		super();
		this.k = k;
	}

	async _getRelevantDocuments(query: string): Promise<Document[]> {
		try {
			const rows = await searchHybrid(query, this.k * 3);
			const top = selectTopWithThreshold(rows, this.k);
			return top.map((row) => new Document({
				pageContent: row.content,
				metadata: {
					url: row.url,
					title: row.title,
					section: row.section
				}
			}));
		} catch (error) {
			console.error("[/api/chat] retriever error", error);
			return [];
		}
	}
}

export async function POST(request: NextRequest) {
	try {
		const { message, history } = await request.json();
		if (!message || typeof message !== "string") {
			return NextResponse.json({ error: "Message is required" }, { status: 400 });
		}

		const normalizedMessage = normalizeInput(message);
		const formattedHistory = Array.isArray(history)
			? mapHistory(history as HistoryMessage[])
			: [];

		if (!hasAIConfigured()) {
			return NextResponse.json({
				response:
					"AI service is not configured. Add OPENAI_API_KEY for cloud AI, or set USE_LOCAL_AI=true and run Ollama locally (see LOCAL_AI_SETUP.md).",
				sources: [],
				notFound: true,
				confidence: 0.1,
				timestamp: new Date().toISOString()
			});
		}

		const llm = getLLM();

		const qaTemplate = PromptTemplate.fromTemplate(
			"You are the MoFPED Help Assistant. Use the conversation history to infer missing details in follow-up questions. " +
				"If you infer context, confirm it in your response (e.g., 'For the 2022 budget paper, I found...'). " +
				"Use provided context flexibly (e.g., speech/document/report synonyms). " +
				"If context is missing, ask for clarification about year or topic instead of saying you don't understand.\n\n" +
				"Question: {question}\nContext: {context}"
		);

		const chain = ConversationalRetrievalQAChain.fromLLM(
			llm,
			new HybridRetriever(5),
			{
				qaTemplate: qaTemplate.template,
				returnSourceDocuments: true
			}
		);

		let result;
		try {
			result = await chain.invoke({
				question: normalizedMessage || message,
				chat_history: formattedHistory
			});
		} catch (error) {
			console.error("[/api/chat] chain error", error);
			return NextResponse.json({
				response: "I ran into an error while searching. Please try again.",
				sources: [],
				notFound: true,
				confidence: 0.1,
				timestamp: new Date().toISOString()
			});
		}

		const text = result?.text ?? result?.answer ?? "Sorry, I couldn't generate a response.";
		const sources = (result?.sourceDocuments ?? []).map((doc: Document) => ({
			url: doc.metadata?.url || "https://www.finance.go.ug",
			title: doc.metadata?.title || "MoFPED Document",
			section: doc.metadata?.section,
			relevance: 0.8
		}));

		return NextResponse.json({
			response: text,
			sources,
			notFound: sources.length === 0,
			confidence: sources.length > 0 ? 0.8 : 0.3,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error("[/api/chat] error", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function GET() {
	return NextResponse.json({ message: "MOFPED chat API running" });
}


