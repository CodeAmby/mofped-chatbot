import { NextRequest, NextResponse } from "next/server";
import { searchDocuments, generateResponse } from "@/lib/rag-simple";

export async function POST(req: NextRequest) {
	const started = Date.now();
	try {
		const { query } = await req.json();
		if (!query || typeof query !== "string" || !query.trim()) {
			return NextResponse.json({ error: "Query is required" }, { status: 400 });
		}

		console.log(`[API] Processing query: "${query}"`);
		
		// Check for special queries that don't need document search
		const queryLower = query.toLowerCase();
		const isPBSQuery = queryLower.includes('pbs') || queryLower.includes('programme based system') || queryLower.includes('programme based');
		const isCFPQuery = queryLower.includes('cfp') || queryLower.includes('climate finance') || queryLower.includes('climate');
		const isContactQuery = queryLower.includes('contact') || queryLower.includes('phone') || queryLower.includes('email') || queryLower.includes('number') || queryLower.includes('support');

		let response;
		
		if (isPBSQuery && !isContactQuery) {
			response = {
				summary: `I found information about the **Programme Based System (PBS)**. What would you like to access?\n\n• **PBS Portal**: Programme-based budgeting and financial management\n• **System Access**: Login to PBS portal for authorized users`,
				sources: [{
					title: "Programme Based System (PBS)",
					url: "https://pbsmof.finance.go.ug/auth/login",
					category: "External Systems"
				}],
				guardrail_status: "ok",
				options: [
					{ text: "Access PBS Portal", action: "external", query: "https://pbsmof.finance.go.ug/auth/login" },
					{ text: "Learn about PBS", action: "info", query: "programme based system" }
				]
			};
		} else if (isCFPQuery && !isContactQuery) {
			response = {
				summary: `I found information about the **Climate Finance Platform (CFP)**. What would you like to access?\n\n• **CFP Portal**: Climate finance tracking and management\n• **User Access**: Login to CFP portal for authorized users`,
				sources: [{
					title: "Climate Finance Platform (CFP)",
					url: "https://climate.finance.go.ug/user/login",
					category: "External Systems"
				}],
				guardrail_status: "ok",
				options: [
					{ text: "Access CFP Portal", action: "external", query: "https://climate.finance.go.ug/user/login" },
					{ text: "Learn about CFP", action: "info", query: "climate finance platform" }
				]
			};
		} else {
			const documents = await searchDocuments(query, 5);
			console.log(`[API] Search returned ${documents.length} documents`);
			response = generateResponse(query, documents);
		}

		return NextResponse.json({
			...response,
			timings: { total_ms: Date.now() - started },
		});
	} catch (e) {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}


