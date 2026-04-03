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
  
  const xdgPath = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'supabase', 'access-token');
  if (existsSync(xdgPath)) return readFileSync(xdgPath, 'utf8').trim();
  
  return null;
}

async function main() {
  const token = await getAccessToken();
  if (!token) {
    console.error('Could not find Supabase access token.');
    process.exit(1);
  }
  
  const sql = `
    ALTER TABLE public.bulk_certificates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can view bulk_certificates for verification" ON public.bulk_certificates;
    CREATE POLICY "Anyone can view bulk_certificates for verification" ON public.bulk_certificates FOR SELECT USING (true);

    ALTER TABLE public.certificate_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can view certificate_logs for verification" ON public.certificate_logs;
    CREATE POLICY "Anyone can view certificate_logs for verification" ON public.certificate_logs FOR SELECT USING (true);
  `;
  
  const res = await fetch('https://api.supabase.com/v1/projects/mjtbybqmlulkodtnhxln/database/query', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  console.log('Status:', res.status, res.statusText);
  const data = await res.text();
  console.log('Response:', data);
}

main().catch(console.error);
