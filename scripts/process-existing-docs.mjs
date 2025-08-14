import 'dotenv/config';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import crypto from "crypto";

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

function chunk(text, chunkSize = 1000, overlap = 150) {
  const chunks = [];
  if (!text || text.length === 0) return chunks;
  const step = Math.max(1, chunkSize - Math.max(0, Math.min(overlap, chunkSize - 1)));
  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
  }
  return chunks;
}

async function embedAll(texts) {
  const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });
  return embeddings.embedDocuments(texts);
}

async function processExistingDocuments() {
  console.log('🔄 Processing existing documents...\n');

  // Get all documents without chunks
  const { data: docs, error: docsError } = await supabase
    .from('Document')
    .select('id, title, url, content, contentType')
    .eq('isActive', true);

  if (docsError) {
    console.error('❌ Error fetching documents:', docsError);
    return;
  }

  console.log(`📄 Found ${docs?.length || 0} documents to process`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of docs || []) {
    try {
      console.log(`\n📝 Processing: ${doc.title || 'No title'} (${doc.url})`);

      // Check if document already has chunks
      const { data: existingChunks } = await supabase
        .from('DocumentChunk')
        .select('id')
        .eq('documentId', doc.id)
        .limit(1);

      if (existingChunks && existingChunks.length > 0) {
        console.log(`  ⏭️  Skipping - already has ${existingChunks.length} chunks`);
        skipped++;
        continue;
      }

      // Get document content
      let content = doc.content;
      
      if (!content) {
        console.log(`  ⚠️  No content available for ${doc.url}`);
        errors++;
        continue;
      }

      // Chunk the content
      const chunks = chunk(content);
      console.log(`  📦 Created ${chunks.length} chunks`);

      if (chunks.length === 0) {
        console.log(`  ⚠️  No chunks created - content too short`);
        errors++;
        continue;
      }

      // Generate embeddings
      console.log(`  🧠 Generating embeddings...`);
      const embeddings = await embedAll(chunks);

      // Insert chunks
      const chunkData = chunks.map((content, i) => ({
        id: crypto.randomUUID(),
        documentId: doc.id,
        content,
        embedding: embeddings[i],
        chunkIndex: i
      }));

      const { error: insertError } = await supabase
        .from('DocumentChunk')
        .insert(chunkData);

      if (insertError) {
        console.error(`  ❌ Error inserting chunks:`, insertError);
        errors++;
      } else {
        console.log(`  ✅ Successfully inserted ${chunks.length} chunks`);
        processed++;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`  ❌ Error processing document:`, error);
      errors++;
    }
  }

  console.log(`\n🎉 Processing complete!`);
  console.log(`  ✅ Processed: ${processed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
}

processExistingDocuments().catch(console.error);
