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

const testDocument = {
  url: "https://finance.go.ug/test",
  title: "MOFPED Overview",
  content: `The Ministry of Finance, Planning and Economic Development (MOFPED) is a government ministry of Uganda responsible for managing the country's fiscal policy, economic planning, and development.

MOFPED's key responsibilities include:
- Formulating and implementing fiscal policy
- Preparing the national budget
- Managing public debt
- Coordinating economic planning
- Overseeing public financial management
- Providing economic policy advice to the government

The ministry works closely with other government agencies to ensure sustainable economic growth and development in Uganda. It plays a crucial role in the country's development agenda and poverty reduction efforts.

MOFPED is headed by the Minister of Finance, Planning and Economic Development and includes several departments and directorates that handle specific aspects of fiscal and economic management.`,
  contentType: "html",
  source: "finance.go.ug",
  section: "overview"
};

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

async function addTestDocument() {
  console.log("[start] Adding test document...");
  
  const contentHash = hashContent(testDocument.content);
  
  // Upsert document
  const { data: doc, error } = await supabase
    .from('Document')
    .upsert({
      url: testDocument.url,
      title: testDocument.title,
      contentType: testDocument.contentType,
      source: testDocument.source,
      section: testDocument.section,
      hash: contentHash,
      isActive: true
    }, { onConflict: 'url' })
    .select()
    .single();
  
  if (error) {
    console.error("[doc-error]:", error);
    return;
  }
  
  console.log(`[doc-ok] Document created with ID: ${doc.id}`);
  
  // Delete existing chunks if any
  await supabase
    .from('DocumentChunk')
    .delete()
    .eq('documentId', doc.id);
  
  const parts = chunk(testDocument.content);
  console.log(`[chunks] Creating ${parts.length} chunks...`);
  
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
      console.error("[chunk-error]:", chunkError);
    } else {
      console.log(`[ok] Inserted ${parts.length} chunks successfully`);
    }
  } catch (e) {
    console.error("[embed-fail]:", e);
  }
  
  console.log("[done] Test document added successfully!");
}

// Run if called directly
if (require.main === module) {
  addTestDocument().catch(console.error);
}
