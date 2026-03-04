import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";

function getSupabaseClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!url || !anonKey) {
		console.warn(
			"[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
		);
		return null;
	}

	return createClient(url, anonKey, { auth: { persistSession: false } });
}

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
	try {
		const supabase = getSupabaseClient();
		if (!supabase) {
			return [];
		}

		console.log(`[search] Query: "${query}"`);
		
		// First, let's see what documents we have
		const { data: docs, error: docsError } = await supabase
			.from('Document')
			.select('id, title, url')
			.eq('isActive', true);

		if (docsError) {
			console.error('Supabase docs error:', docsError);
			return [];
		}

		console.log(`[search] Found ${docs?.length || 0} active documents`);
		
		if (!docs || docs.length === 0) {
			return [];
		}

		// For now, return the first document as a test
		const doc = docs[0];
		console.log(`[search] Using document: ${doc.title} (${doc.url})`);
		
		// Get chunks for this document
		const { data: chunks, error: chunksError } = await supabase
			.from('DocumentChunk')
			.select('id, content, chunkIndex')
			.eq('documentId', doc.id)
			.order('chunkIndex', { ascending: true })
			.limit(limit);

		if (chunksError) {
			console.error('Supabase chunks error:', chunksError);
			return [];
		}

		console.log(`[search] Found ${chunks?.length || 0} chunks`);

		return chunks?.map((chunk: { id: string; content: string; chunkIndex: number }) => ({
			chunkId: chunk.id,
			documentId: doc.id,
			content: chunk.content,
			url: doc.url,
			title: doc.title,
			section: null,
			score: 0.1 // Placeholder score
		})) || [];
	} catch (error) {
		console.error('Search error:', error);
		return [];
	}
}

export function selectTopWithThreshold(rows: RetrievedChunk[], maxReturn = 5) {
	console.log(`[filter] Input rows: ${rows.length}`);
	console.log(`[filter] Scores:`, rows.map(r => r.score));
	const filtered = rows.filter((r) => r.score < 0.35).slice(0, maxReturn);
	console.log(`[filter] Output rows: ${filtered.length}`);
	return filtered;
}
