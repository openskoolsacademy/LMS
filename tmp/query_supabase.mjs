import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkData() {
  const { data: courses, error: err1 } = await supabase.from('courses').select('*');
  console.log('Courses:', courses, err1 || '');

  const { data: bootcamps, error: err2 } = await supabase.from('live_bootcamps').select('*');
  console.log('Bootcamps:', bootcamps, err2 || '');
}
checkData();
