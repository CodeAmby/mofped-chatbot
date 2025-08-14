import { NextRequest, NextResponse } from "next/server";
import { searchHybrid, selectTopWithThreshold } from "@/lib/rag-supabase";

export async function POST(req: NextRequest) {
	const started = Date.now();
	try {
		const { query } = await req.json();
		if (!query || typeof query !== "string" || !query.trim()) {
			return NextResponse.json({ error: "Query is required" }, { status: 400 });
		}

		console.log(`[API] Processing query: "${query}"`);
		const results = await searchHybrid(query, 20);
		console.log(`[API] Search returned ${results.length} results`);
		const top = selectTopWithThreshold(results, 5);
		console.log(`[API] After filtering: ${top.length} results`);

		if (top.length === 0) {
			return NextResponse.json({
				summary: "I couldn’t find this on finance.go.ug. Try adjusting your terms or browse Budget Documents.",
				sources: [],
				guardrail_status: "not_found",
				timings: { total_ms: Date.now() - started },
			});
		}

		// Simple summary concatenation placeholder (replace with LLM call but gated to retrieved text only)
		const summary = top
			.slice(0, 2)
			.map((r) => r.content.slice(0, 300))
			.join("\n\n");

		return NextResponse.json({
			summary,
			sources: top.map((r) => ({ url: r.url, title: r.title, section: r.section })),
			guardrail_status: "ok",
			timings: { total_ms: Date.now() - started },
		});
	} catch (e) {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}


