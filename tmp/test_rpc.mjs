import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const url = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

fetch(`${url}/rest/v1/rpc/get_all_course_stats`, {
  method: 'POST',
  headers: { apikey: key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: '{}'
}).then(r => r.json()).then(data => {
  console.log('Total rows:', data.length);
  console.log('Sample:', JSON.stringify(data.slice(0,2), null, 2));
  console.log('Keys:', data.length ? Object.keys(data[0]) : 'none');
}).catch(e => console.error(e));
