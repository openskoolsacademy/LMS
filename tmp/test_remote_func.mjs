const funcUrl = 'https://mjtbybqmlulkodtnhxln.supabase.co/functions/v1/create-razorpay-order';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qdGJ5YnFtbHVsa29kdG5oeGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjUxNTYsImV4cCI6MjA5MDA0MTE1Nn0.VtJf0ZDF13gslPyRfdpAJtHR5deA-4pIHelx9-frr9I';

async function testRemoteFunction() {
  console.log('--- TESTING DEPLOYED FUNCTION ---');
  try {
    const res = await fetch(funcUrl, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        course_id: '48d46a66-87a3-4f4b-9f6b-84ddeb7cc6f9',
        coupon_code: 'OPEN50'
      })
    });
    
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);

  } catch (err) {
    console.log('FATAL:', err.message);
  }
}

testRemoteFunction();
