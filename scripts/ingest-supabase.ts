import * as cheerio from "cheerio";
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const START_URLS = ["https://finance.go.ug/"];
const ALLOWED_HOSTS = new Set(["finance.go.ug", "budget.finance.go.ug"]);

async function fetchHtml(url: string): Promise<string> {
    try {
        const res = await fetch(url, { 
            headers: { 
                "user-agent": "MoFPED-Chatbot/1.0", 
                "accept": "text/html,*/*;q=0.1" 
            },
            // Add timeout and retry logic
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.text();
    } catch (error) {
        console.error(`[fetch-error] ${url}:`, error);
        throw error;
    }
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
    
    // Check if document exists and has same hash
    const { data: existing } = await supabase
        .from('Document')
        .select('id, hash')
        .eq('url', url)
        .single();
    
    if (existing && existing.hash === contentHash) {
        console.log(`[skip] Unchanged: ${url}`);
        return existing.id;
    }
    
    // Upsert document
    const { data: doc, error } = await supabase
        .from('Document')
        .upsert({
            url,
            title,
            content: fullText,
            contentType: "html",
            source: host,
            section,
            hash: contentHash,
            isActive: true
        }, { onConflict: 'url' })
        .select()
        .single();
    
    if (error) {
        console.error(`[doc-error] ${url}:`, error);
        return null;
    }
    
    // Delete existing chunks if document was updated
    if (existing) {
        await supabase
            .from('DocumentChunk')
            .delete()
            .eq('documentId', doc.id);
    }
    
    const parts = chunk(fullText);
    console.log(`[chunks] ${url} → ${parts.length}`);
    
    try {
        const vecs = await embedAll(parts);
        
        // Insert chunks with embeddings
        const chunks = parts.map((content, i) => ({
            id: crypto.randomUUID(),
            documentId: doc.id,
            content,
            embedding: vecs[i],
            chunkIndex: i
        }));
        
        const { error: chunkError } = await supabase
            .from('DocumentChunk')
            .insert(chunks);
        
        if (chunkError) {
            console.error(`[chunk-error] ${url}:`, chunkError);
        } else {
            console.log(`[ok] Inserted ${parts.length} chunks for ${url}`);
        }
    } catch (e) {
        console.error(`[embed-fail] ${url}`, e);
    }
    
    return doc.id;
}

export async function runIngest() {
    const seen = new Set<string>();
    const queue: string[] = [...START_URLS];
    
    console.log(`[start] Ingestion with ${queue.length} seed URLs`);
    
    while (queue.length > 0 && seen.size < 50) { // Limit to 50 pages
        const url = queue.shift()!;
        if (seen.has(url)) continue;
        seen.add(url);
        
        try {
            console.log(`[fetch] ${url}`);
            const html = await fetchHtml(url);
            const { title, text, links } = extractLinksAndText(url, html);
            
            if (text.length > 100) { // Only process pages with substantial content
                await upsertDocument(url, title, text, null);
            }
            
            // Add new links to queue
            for (const link of links) {
                if (!seen.has(link) && queue.length < 100) {
                    queue.push(link);
                }
            }
            
            // Small delay to be respectful
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`[error] ${url}:`, error);
        }
    }
    
    console.log(`[done] Processed ${seen.size} URLs`);
}

// Run if called directly
if (require.main === module) {
    runIngest().catch(console.error);
}
