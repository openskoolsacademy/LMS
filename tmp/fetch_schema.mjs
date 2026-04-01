import fs from 'fs';
const envFile = fs.readFileSync('../.env.local', 'utf8');
const url = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

fetch(`${url}/rest/v1/certificates?select=*&limit=1`, {
  headers: { apikey: key, 'Authorization': `Bearer ${key}` }
}).then(r => r.json()).then(console.log);
