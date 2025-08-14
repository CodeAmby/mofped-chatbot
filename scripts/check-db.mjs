import 'dotenv/config';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function checkDatabase() {
  console.log('🔍 Checking database state...\n');

  // Check documents
  const { data: docs, error: docsError } = await supabase
    .from('Document')
    .select('id, title, url, isActive, createdAt, category, description')
    .order('createdAt', { ascending: false });

  if (docsError) {
    console.error('❌ Error fetching documents:', docsError);
    return;
  }

  console.log(`📄 Documents found: ${docs?.length || 0}`);

  if (docs && docs.length > 0) {
    console.log('\n📋 Sample documents:');
    docs.slice(0, 5).forEach((doc, i) => {
      console.log(`  ${i + 1}. ${doc.title || 'No title'} (${doc.url})`);
      console.log(`     Active: ${doc.isActive}, Created: ${doc.createdAt}`);
      console.log(`     Category: ${doc.category || 'None'}, Description: ${doc.description?.substring(0, 50) || 'None'}...`);
    });
  }

  // Check excerpts
  const { data: excerpts, error: excerptsError } = await supabase
    .from('DocumentExcerpt')
    .select('id, documentId, excerpt, relevance')
    .limit(10);

  console.log('Raw excerpts query result:', { excerpts, error: excerptsError });

  if (excerptsError) {
    console.error('❌ Error fetching excerpts:', excerptsError);
    return;
  }

  console.log(`\n📝 Excerpts found: ${excerpts?.length || 0}`);

  if (excerpts && excerpts.length > 0) {
    console.log('\n📄 Sample excerpts:');
    excerpts.slice(0, 3).forEach((excerpt, i) => {
      console.log(`  ${i + 1}. Document: ${excerpt.documentId}, Relevance: ${excerpt.relevance}`);
      console.log(`     Excerpt: ${excerpt.excerpt?.substring(0, 100)}...`);
    });
  }

  // Count documents with excerpts
  const { data: excerptCounts, error: countError } = await supabase
    .from('DocumentExcerpt')
    .select('documentId')
    .eq('documentId', docs?.[0]?.id || '');

  if (countError) {
    console.error('❌ Error counting excerpts:', countError);
  } else {
    console.log(`\n📊 Sample document excerpt count: ${excerptCounts?.length || 0}`);
  }

  // Show category distribution
  const categories = {};
  docs?.forEach(doc => {
    const category = doc.category || 'Other';
    categories[category] = (categories[category] || 0) + 1;
  });

  console.log('\n📊 Category distribution:');
  Object.entries(categories).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} documents`);
  });
}

checkDatabase().catch(console.error);
