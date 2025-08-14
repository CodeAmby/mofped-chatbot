import { prisma } from "@/lib/prisma";
import { OpenAIEmbeddings } from "@langchain/openai";

export interface RetrievedChunk {
	chunkId: string;
	documentId: string;
	content: string;
	url: string;
	title: string | null;
	section: string | null;
	score: number; // distance
}

export async function embedQuery(text: string): Promise<number[]> {
	const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });
	return embeddings.embedQuery(text);
}

export async function searchHybrid(query: string, limit = 20): Promise<RetrievedChunk[]> {
	const qVec = await embedQuery(query);
	// Vector search only (pgvector). BM25 can be added later via tsvector/ts_rank.
	const rows = await prisma.$queryRawUnsafe<Array<{ chunkId: string; documentId: string; content: string; url: string; title: string; section: string; score: number }>>(
		`SELECT dc.id as "chunkId", dc."documentId", dc.content, d.url, d.title, d.section,
		 dc.embedding <=> $1::vector as score
		 FROM "DocumentChunk" dc
		 JOIN "Document" d ON d.id = dc."documentId"
		 WHERE d."isActive" = true
		 ORDER BY score ASC
		 LIMIT ${limit}`,
		qVec as number[],
	);
	return rows as RetrievedChunk[];
}

export function selectTopWithThreshold(rows: RetrievedChunk[], maxReturn = 5) {
	const filtered = rows.filter((r) => r.score < 0.35).slice(0, maxReturn);
	return filtered;
}


