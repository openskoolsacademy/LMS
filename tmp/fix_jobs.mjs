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
    console.error('No Supabase access token found. Please run: npx supabase login');
    process.exit(1);
  }

  const sql = `UPDATE public.jobs SET expiry_date = '2026-07-10' WHERE expiry_date < '2026-04-11';`;

  const res = await fetch('https://api.supabase.com/v1/projects/mjtbybqmlulkodtnhxln/database/query', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  console.log('Status:', res.status);
  const data = await res.text();
  console.log('Response:', data);
}

main().catch(console.error);
