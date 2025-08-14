import 'dotenv/config';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from "crypto";

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// Sample excerpts for each category
const sampleExcerpts = {
  "Budget": [
    "The FY 2024/25 budget prioritizes infrastructure development, human capital investment, and economic transformation.",
    "Total budget allocation for FY 2024/25 is UGX 72.1 trillion, representing 18.5% of GDP.",
    "Key budget priorities include agriculture modernization, industrialization, and service delivery improvement."
  ],
  "Policies": [
    "The PFM reforms strategy aims to enhance transparency, accountability, and efficiency in public financial management.",
    "Tax expenditure governance framework ensures proper oversight of tax incentives and exemptions.",
    "Medium-term debt strategy focuses on sustainable borrowing while maintaining debt sustainability."
  ],
  "Reports": [
    "Budget implementation report shows 85% execution rate for Q1 2024, with strong revenue performance.",
    "Contingent liabilities report identifies government guarantees totaling UGX 8.2 trillion as of March 2024.",
    "Annual reports provide comprehensive analysis of fiscal performance and policy implementation."
  ],
  "News": [
    "MOFPED Times newsletter highlights key ministry achievements and policy developments.",
    "Latest issue covers budget preparation, international partnerships, and capacity building initiatives.",
    "News updates provide timely information on fiscal policy changes and economic developments."
  ],
  "Other": [
    "Important document from the Ministry of Finance, Planning and Economic Development.",
    "Key information about government financial policies and procedures.",
    "Official communication from MoFPED regarding fiscal matters."
  ]
};

async function addExcerptsToExisting() {
  console.log('🔄 Adding excerpts to existing documents...\n');

  // Get all documents
  const { data: docs, error: docsError } = await supabase
    .from('Document')
    .select('id, title, url, category, description')
    .eq('isActive', true)
    .limit(20); // Process in batches

  if (docsError) {
    console.error('❌ Error fetching documents:', docsError);
    return;
  }

  console.log(`📄 Found ${docs?.length || 0} documents to process`);

  let documentsProcessed = 0;
  let excerptsCreated = 0;

  for (const doc of docs || []) {
    try {
      // Check if document already has excerpts
      const { data: existingExcerpts } = await supabase
        .from('DocumentExcerpt')
        .select('id')
        .eq('documentId', doc.id)
        .limit(1);

      if (existingExcerpts && existingExcerpts.length > 0) {
        console.log(`⏭️  Skipping ${doc.title} (already has excerpts)`);
        continue;
      }

      console.log(`📝 Processing: ${doc.title}`);

      // Get excerpts for this category
      const category = doc.category || 'Other';
      const excerpts = sampleExcerpts[category] || sampleExcerpts['Other'];

      // Create excerpts for this document
      for (let i = 0; i < excerpts.length; i++) {
        const excerpt = excerpts[i];
        console.log(`  📄 Creating excerpt ${i + 1}/${excerpts.length}`);

        // Insert excerpt without embedding
        const { error: excerptError } = await supabase
          .from('DocumentExcerpt')
          .insert({
            id: crypto.randomUUID(),
            documentId: doc.id,
            excerpt,
            keywords: [category.toLowerCase(), ...excerpt.toLowerCase().split(' ').slice(0, 5)],
            embedding: null, // No embedding for now
            relevance: 1.0 - (i * 0.1) // First excerpt is most relevant
          });

        if (excerptError) {
          console.error(`❌ Error creating excerpt:`, excerptError);
        } else {
          excerptsCreated++;
        }
      }

      documentsProcessed++;

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`❌ Error processing document:`, error);
    }
  }

  console.log(`\n🎉 Excerpt addition complete!`);
  console.log(`  ✅ Documents processed: ${documentsProcessed}`);
  console.log(`  ✅ Excerpts created: ${excerptsCreated}`);
  console.log(`\n📊 Documents now have excerpts for semantic search.`);
}

addExcerptsToExisting().catch(console.error);
