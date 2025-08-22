import { NextRequest, NextResponse } from "next/server";
import { handleMoFPEDQuery } from "@/lib/mofped-response-handler";

export async function POST(req: NextRequest) {
	const started = Date.now();
	try {
		const { query } = await req.json();
		if (!query || typeof query !== "string" || !query.trim()) {
			return NextResponse.json({ error: "Query is required" }, { status: 400 });
		}

		console.log(`[API] Processing MoFPED query: "${query}"`);
		
		// Use the new MoFPED response handler with intent routing
		const response = await handleMoFPEDQuery(query);

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


