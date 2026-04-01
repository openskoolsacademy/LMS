import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mjtbybqmlulkodtnhxln.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qdGJ5YnFtbHVsa29kdG5oeGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjUxNTYsImV4cCI6MjA5MDA0MTE1Nn0.VtJf0ZDF13gslPyRfdpAJtHR5deA-4pIHelx9-frr9I';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
  const { data, error } = await supabase.from('courses').select('id, title, category');
  if (error) { console.error(error); return; }
  console.log('Current course categories:');
  data.forEach(c => console.log(`  ${c.title}: "${c.category}"`));
}
checkCategories();
