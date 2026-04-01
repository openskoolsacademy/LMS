// Script to migrate all existing course categories to "AI Productivity & Prompting"
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mjtbybqmlulkodtnhxln.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qdGJ5YnFtbHVsa29kdG5oeGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjUxNTYsImV4cCI6MjA5MDA0MTE1Nn0.VtJf0ZDF13gslPyRfdpAJtHR5deA-4pIHelx9-frr9I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateCourseCategories() {
  console.log('🔄 Fetching all courses...');
  
  const { data: courses, error: fetchError } = await supabase
    .from('courses')
    .select('id, title, category');
  
  if (fetchError) {
    console.error('❌ Error fetching courses:', fetchError.message);
    return;
  }
  
  console.log(`📊 Found ${courses.length} courses to migrate.`);
  
  for (const course of courses) {
    console.log(`  → Updating "${course.title}" (${course.category} → AI Productivity & Prompting)`);
    
    const { error: updateError } = await supabase
      .from('courses')
      .update({ category: 'AI Productivity & Prompting' })
      .eq('id', course.id);
    
    if (updateError) {
      console.error(`  ❌ Failed to update "${course.title}":`, updateError.message);
    } else {
      console.log(`  ✅ Updated "${course.title}" successfully.`);
    }
  }
  
  console.log('\n🎉 Migration complete!');
}

migrateCourseCategories();
