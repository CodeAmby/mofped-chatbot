import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { 
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'); 
  process.exit(1); 
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from('Document')
  .select('id,title,url,isActive')
  .eq('isActive', true)
  .limit(1);

if (error) { 
  console.error('Smoke FAILED:', error.message); 
  process.exit(2); 
}

console.log('Smoke OK. Rows:', Array.isArray(data) ? data.length : 0);
