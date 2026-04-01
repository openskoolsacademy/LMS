import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mjtbybqmlulkodtnhxln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qdGJ5YnFtbHVsa29kdG5oeGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjUxNTYsImV4cCI6MjA5MDA0MTE1Nn0.VtJf0ZDF13gslPyRfdpAJtHR5deA-4pIHelx9-frr9I'
);

// Sign in as admin to insert notifications for both users
const { data: authData } = await supabase.auth.signInWithPassword({
  email: 'veerarajakumaran529@gmail.com',
  password: 'Test@123'
});

const adminId = authData.user.id;
console.log('Admin ID:', adminId);

// Insert multiple notifications for admin
const adminNotifs = [
  { user_id: adminId, title: '🎉 Platform Milestone', message: 'Open Skools has reached 100+ registered learners! Keep up the great work.', type: 'achievement', read: false },
  { user_id: adminId, title: '📚 New Course Submitted', message: '<strong>Demo Course</strong> was submitted for review by an instructor.', type: 'course', read: false },
  { user_id: adminId, title: '💳 New Payment Received', message: 'A student purchased <strong>"Demo Course"</strong> for ₹1.', type: 'payment', read: false },
];

const { error: adminErr } = await supabase.from('notifications').insert(adminNotifs);
console.log('Admin notifications insert error:', adminErr);

// Now sign in as the other user
const { data: authData2, error: authErr2 } = await supabase.auth.signInWithPassword({
  email: 'karthikselvasiva933@gmail.com',
  password: 'Test@123'
});

if (authErr2) { console.log('User2 auth error:', authErr2); process.exit(0); }

const userId2 = authData2.user.id;
console.log('User2 ID:', userId2);

const userNotifs = [
  { user_id: userId2, title: 'Welcome to Open Skools!', message: 'Your account is set up and ready to go. Start exploring courses!', type: 'system', read: false },
  { user_id: userId2, title: '📚 Course Enrolled', message: 'You have been enrolled in <strong>"Demo Course"</strong>. Start learning now!', type: 'course', read: false },
];

const { error: userErr } = await supabase.from('notifications').insert(userNotifs);
console.log('User2 notifications insert error:', userErr);

console.log('Done! Notifications seeded for both users.');
process.exit(0);
