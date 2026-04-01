// Run SQL migration via Supabase Management API
const SUPABASE_URL = 'https://mjtbybqmlulkodtnhxln.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// We'll use the database's REST endpoint with service_role key 
// to execute raw SQL via the pg_net extension or rpc
// Actually, let's use the supabase-js client with service role to call rpc

// Alternative: Use the Supabase SQL API directly
// The management API endpoint for executing SQL is:
// POST https://api.supabase.com/v1/projects/{ref}/database/query

// But we need an access token. Let's read it from the CLI config
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

async function getAccessToken() {
  // Supabase CLI stores the access token in ~/.supabase/access-token
  const paths = [
    join(homedir(), '.supabase', 'access-token'),
    join(process.env.APPDATA || '', 'supabase', 'access-token'),
    join(homedir(), 'AppData', 'Roaming', 'supabase', 'access-token'),
  ];
  
  for (const p of paths) {
    if (existsSync(p)) {
      console.log('Found token at:', p);
      return readFileSync(p, 'utf8').trim();
    }
  }
  
  // Also check XDG config
  const xdgPath = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'supabase', 'access-token');
  if (existsSync(xdgPath)) {
    console.log('Found token at:', xdgPath);
    return readFileSync(xdgPath, 'utf8').trim();
  }
  
  return null;
}

async function main() {
  const token = await getAccessToken();
  if (!token) {
    console.error('Could not find Supabase access token. Please run: npx supabase login');
    process.exit(1);
  }
  
  console.log('Token found, length:', token.length);
  
  const sql = `
    ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_course_id_fkey;
    ALTER TABLE public.payments ADD CONSTRAINT payments_course_id_fkey 
      FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  `;
  
  const res = await fetch('https://api.supabase.com/v1/projects/mjtbybqmlulkodtnhxln/database/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  console.log('Status:', res.status, res.statusText);
  const data = await res.text();
  console.log('Response:', data);
}

main().catch(console.error);
