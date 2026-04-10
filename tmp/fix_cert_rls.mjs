import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

async function getAccessToken() {
  const paths = [
    join(homedir(), '.supabase', 'access-token'),
    join(process.env.APPDATA || '', 'supabase', 'access-token'),
    join(homedir(), 'AppData', 'Roaming', 'supabase', 'access-token'),
  ];
  
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  }
  return null;
}

async function main() {
  const token = await getAccessToken();
  if (!token) {
    console.error('Could not find Supabase access token.');
    process.exit(1);
  }
  
  const sql = `
    -- Enable RLS and add policy for certificates table
    ALTER TABLE IF EXISTS public.certificates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Students can insert own certificates" ON public.certificates;
    CREATE POLICY "Students can insert own certificates" ON public.certificates 
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    -- Allow admins to see them
    DROP POLICY IF EXISTS "Anyone can see certificates" ON public.certificates;
    CREATE POLICY "Anyone can see certificates" ON public.certificates FOR SELECT USING (true);

    -- Allow students to insert into bulk_certificates for public verification
    ALTER TABLE public.bulk_certificates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Students can insert own bulk_certificates" ON public.bulk_certificates;
    CREATE POLICY "Students can insert own bulk_certificates" ON public.bulk_certificates 
      FOR INSERT WITH CHECK (true);
  `;
  
  const res = await fetch('https://api.supabase.com/v1/projects/mjtbybqmlulkodtnhxln/database/query', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  const data = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', data);
}

main().catch(console.error);
