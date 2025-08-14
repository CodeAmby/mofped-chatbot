import 'dotenv/config';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function migrateSchema() {
  console.log('🔄 Migrating database schema...\n');

  try {
    // Add new columns to Document table
    console.log('📄 Adding columns to Document table...');
    
    const alterQueries = [
      'ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "description" TEXT;',
      'ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "category" TEXT;',
      'ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "publishDate" TIMESTAMP;',
      'ALTER TABLE "Document" DROP COLUMN IF EXISTS "content";',
      'ALTER TABLE "Document" DROP COLUMN IF EXISTS "section";',
      'ALTER TABLE "Document" DROP COLUMN IF EXISTS "hash";',
      'ALTER TABLE "Document" DROP COLUMN IF EXISTS "lastModified";'
    ];

    for (const query of alterQueries) {
      const { error } = await supabase.rpc('exec_sql', { sql: query });
      if (error) {
        console.log(`  ⚠️  ${query}: ${error.message}`);
      } else {
        console.log(`  ✅ ${query}`);
      }
    }

    // Create DocumentExcerpt table
    console.log('\n📝 Creating DocumentExcerpt table...');
    
    const createExcerptTable = `
      CREATE TABLE IF NOT EXISTS "DocumentExcerpt" (
        "id" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "excerpt" TEXT NOT NULL,
        "keywords" TEXT[],
        "embedding" vector(1536),
        "relevance" DOUBLE PRECISION DEFAULT 1.0,
        "createdAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT "DocumentExcerpt_pkey" PRIMARY KEY ("id")
      );
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { sql: createExcerptTable });
    if (createError) {
      console.log(`  ⚠️  Create table: ${createError.message}`);
    } else {
      console.log('  ✅ DocumentExcerpt table created');
    }

    // Add indexes
    console.log('\n🔍 Adding indexes...');
    
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS "Document_category_idx" ON "Document"("category");',
      'CREATE INDEX IF NOT EXISTS "Document_publishDate_idx" ON "Document"("publishDate");',
      'CREATE INDEX IF NOT EXISTS "DocumentExcerpt_documentId_idx" ON "DocumentExcerpt"("documentId");',
      'CREATE INDEX IF NOT EXISTS "DocumentExcerpt_relevance_idx" ON "DocumentExcerpt"("relevance");'
    ];

    for (const query of indexQueries) {
      const { error } = await supabase.rpc('exec_sql', { sql: query });
      if (error) {
        console.log(`  ⚠️  ${query}: ${error.message}`);
      } else {
        console.log(`  ✅ ${query}`);
      }
    }

    // Update existing documents with sample data
    console.log('\n📊 Updating existing documents...');
    
    const { data: existingDocs } = await supabase
      .from('Document')
      .select('id, title, url')
      .limit(5);

    if (existingDocs && existingDocs.length > 0) {
      console.log(`  Found ${existingDocs.length} existing documents to update`);
      
      for (const doc of existingDocs) {
        // Determine category based on URL
        let category = 'Other';
        if (doc.url.includes('budget') || doc.url.includes('Budget')) category = 'Budget';
        else if (doc.url.includes('report') || doc.url.includes('Report')) category = 'Reports';
        else if (doc.url.includes('policy') || doc.url.includes('Policy')) category = 'Policies';
        else if (doc.url.includes('news') || doc.url.includes('News')) category = 'News';

        const { error } = await supabase
          .from('Document')
          .update({
            category,
            description: `Document about ${category.toLowerCase()} from MoFPED.`,
            publishDate: new Date().toISOString()
          })
          .eq('id', doc.id);

        if (error) {
          console.log(`  ⚠️  Error updating ${doc.title}: ${error.message}`);
        } else {
          console.log(`  ✅ Updated ${doc.title} with category: ${category}`);
        }
      }
    }

    console.log('\n🎉 Schema migration complete!');
    console.log('📊 Database is now ready for the simplified document discovery approach.');

  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

migrateSchema().catch(console.error);
