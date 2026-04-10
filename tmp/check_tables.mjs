import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTables() {
  const { error: e1 } = await supabase.from('certificates').select('*').limit(1);
  console.log('certificates table err:', e1);

  const { error: e2 } = await supabase.from('certificate_logs').select('*').limit(1);
  console.log('certificate_logs table err:', e2);

  const { error: e3 } = await supabase.from('bulk_certificates').select('*').limit(1);
  console.log('bulk_certificates table err:', e3);
}

checkTables();
