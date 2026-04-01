import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const url = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const instructorId = '4a5b99ac-6166-435d-bd26-8924fd642290';

fetch(`${url}/rest/v1/courses?instructor_id=eq.${instructorId}&select=id,title`, {
  headers: { apikey: key, 'Authorization': `Bearer ${key}` }
}).then(r => r.json()).then(async courses => {
  console.log('Instructor Courses:', courses.length);
  const courseIds = courses.map(c => c.id);
  
  if (courseIds.length === 0) return;

  const enrollRes = await fetch(`${url}/rest/v1/enrollments?course_id=in.(${courseIds.join(',')})&select=id`, {
    headers: { apikey: key, 'Authorization': `Bearer ${key}` }
  });
  const enrollments = await enrollRes.json();
  console.log('Total Enrollments for these courses:', enrollments.length);

  const statsRes = await fetch(`${url}/rest/v1/rpc/get_all_course_stats`, {
    method: 'POST',
    headers: { apikey: key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const stats = await statsRes.json();
  const instructorStats = stats.filter(s => courseIds.includes(s.rpc_course_id));
  console.log('Instructor Stats from RPC:', JSON.stringify(instructorStats, null, 2));

}).catch(e => console.error(e));
