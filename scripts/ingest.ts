import * as cheerio from "cheerio";
import { prisma } from "../src/lib/prisma";
import { OpenAIEmbeddings } from "@langchain/openai";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local" });

const START_URLS = ["https://finance.go.ug/"];
const ALLOWED_HOSTS = new Set(["finance.go.ug", "budget.finance.go.ug"]);

async function fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, { headers: { "user-agent": "MoFPED-Chatbot/1.0", "accept": "text/html,*/*;q=0.1" } });
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return res.text();
}

function extractLinksAndText(baseUrl: string, html: string) {
	const $ = cheerio.load(html);
	$("script,style,nav,header,footer").remove();
	const title = $("title").first().text().trim() || $("h1").first().text().trim() || null;
	const text = $("main, article, .content, #content").text() || $("body").text();
	const cleaned = text.replace(/\s+/g, " ").trim();
	const links: string[] = [];
    const disallowExt = [
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
        ".mp4", ".mp3", ".avi", ".mov",
        ".zip", ".tar", ".gz", ".7z",
    ];
    $("a[href]").each((_, el) => {
		const href = $(el).attr("href");
		if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
		try {
			const abs = new URL(href, baseUrl).href;
			const host = new URL(abs).hostname;
            const lower = abs.toLowerCase();
            if (disallowExt.some((ext) => lower.endsWith(ext))) return;
            if (ALLOWED_HOSTS.has(host)) links.push(abs);
		} catch {}
	});
	return { title, text: cleaned, links };
}

function chunk(text: string, chunkSize = 1000, overlap = 150) {
    const chunks: string[] = [];
    if (!text || text.length === 0) return chunks;
    const step = Math.max(1, chunkSize - Math.max(0, Math.min(overlap, chunkSize - 1)));
    for (let start = 0; start < text.length; start += step) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        if (end === text.length) break;
    }
    return chunks;
}

async function embedAll(texts: string[]) {
	const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });
	return embeddings.embedDocuments(texts);
}

function hashContent(text: string) {
	return crypto.createHash("sha256").update(text).digest("hex");
}

async function upsertDocument(url: string, title: string | null, fullText: string, section: string | null) {
	const host = new URL(url).hostname;
	const contentHash = hashContent(fullText);
	const existing = await prisma.document.findUnique({ where: { url } });
	if (existing && existing.hash === contentHash) {
		console.log(`[skip] Unchanged: ${url}`);
		return existing.id;
	}
	const doc = await prisma.document.upsert({
		where: { url },
		update: { title: title ?? undefined, hash: contentHash, section: section ?? undefined },
		create: { url, title, contentType: "html", source: host, section, hash: contentHash },
	});
	if (existing) await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });
	const parts = chunk(fullText);
	console.log(`[chunks] ${url} → ${parts.length}`);
	try {
		const vecs = await embedAll(parts);
		for (let i = 0; i < parts.length; i++) {
			const id = crypto.randomUUID();
			const vec = vecs[i] as number[];
			const vecLiteral = `'[${vec.join(",")}]'::vector`;
			const sql = `INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "chunkIndex") VALUES ('${id}', '${doc.id}', $${1}, ${vecLiteral}, ${i})`;
			await prisma.$executeRawUnsafe(sql, parts[i]);
		}
		console.log(`[ok] Inserted ${parts.length} chunks for ${url}`);
	} catch (e) {
		console.error(`[embed-fail] ${url}`, e);
	}
	return doc.id;
}

export async function runIngest() {
	const seen = new Set<string>();
	const queue: string[] = [...START_URLS];
	while (queue.length) {
		const url = queue.shift()!;
		if (seen.has(url)) continue;
		seen.add(url);
		try {
			console.log(`[fetch] ${url}`);
			const html = await fetchHtml(url);
			const { title, text, links } = extractLinksAndText(url, html);
			if (text && text.length > 300) {
				await upsertDocument(url, title, text, null);
			}
			for (const l of links) if (!seen.has(l) && queue.length < 200) queue.push(l);
			await new Promise((r) => setTimeout(r, 600));
		} catch (e) {
			console.error(`[error] ${url}`, e);
		}
	}
}

if (require.main === module) {
	runIngest()
		.then(() => process.exit(0))
		.catch(() => process.exit(1));
}


