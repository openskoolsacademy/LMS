import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mjtbybqmlulkodtnhxln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qdGJ5YnFtbHVsa29kdG5oeGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjUxNTYsImV4cCI6MjA5MDA0MTE1Nn0.VtJf0ZDF13gslPyRfdpAJtHR5deA-4pIHelx9-frr9I';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("--- COURSES ---");
  const { data: courses, error: courseError } = await supabase.from('courses').select('id, title, price, regular_price, offer_price, is_coupon_applicable');
  if (courseError) {
    console.error(courseError);
  } else {
    console.log(JSON.stringify(courses, null, 2));
  }

  console.log("\n--- COUPONS ---");
  const { data: coupons, error: couponError } = await supabase.from('coupons').select('*');
  if (couponError) {
    console.error(couponError);
  } else {
    console.log(JSON.stringify(coupons, null, 2));
  }
}

check();
