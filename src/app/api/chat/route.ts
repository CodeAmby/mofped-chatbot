import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const { message } = await request.json();
		if (!message || typeof message !== "string") {
			return NextResponse.json({ error: "Message is required" }, { status: 400 });
		}

		const lower = message.toLowerCase();
		let response = "";
		let sources: Array<{ url: string; title: string; section?: string; relevance: number } > = [];
		let notFound = false;
		let confidence = 0.8;

		if (lower.includes("budget") && lower.includes("execution")) {
			response = "The Budget Execution Circular for FY 2025/26 outlines rules for implementation, expenditure controls, and reporting. You can find it under Budget Documents on the Ministry of Finance website.";
			sources = [
				{ url: "https://finance.go.ug/budget-documents", title: "Budget Execution Circular FY 2025/26", section: "Budget Documents", relevance: 0.95 },
			];
		} else if (lower.includes("nbfp") || lower.includes("framework")) {
			response = "The National Budget Framework Paper (NBFP) for FY 2025/26 sets out fiscal priorities and macroeconomic assumptions used in budget preparation.";
			sources = [
				{ url: "https://finance.go.ug/budget-documents", title: "National Budget Framework Paper FY 2025/26", section: "Budget Documents", relevance: 0.92 },
			];
		} else if (lower.includes("budget speech") && (lower.includes("when") || lower.includes("date"))) {
			response = "The National Budget Speech is typically presented in June each year, with the exact date announced by the Ministry and aligned to the parliamentary calendar.";
			sources = [
				{ url: "https://budget.finance.go.ug", title: "Budget Portal — Timeline", section: "Timeline", relevance: 0.88 },
			];
		} else if (lower.includes("kenya") || lower.includes("tanzania") || lower.includes("rwanda")) {
			response = "I couldn’t find this on finance.go.ug. Please ask about Uganda’s Ministry of Finance content, or browse the Budget Documents section.";
			notFound = true;
			confidence = 0.1;
		} else {
			response = `I understand you're asking about "${message}". This is a demo response. In production, I will search finance.go.ug documents and return a concise, cited answer.`;
			sources = [
				{ url: "https://finance.go.ug", title: "Ministry of Finance, Planning and Economic Development", relevance: 0.7 },
			];
		}

		return NextResponse.json({
			response,
			sources,
			notFound,
			confidence,
			timestamp: new Date().toISOString(),
		});
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function GET() {
	return NextResponse.json({ message: "MOFPED demo API running" });
}


