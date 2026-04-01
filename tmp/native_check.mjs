const supabaseUrl = 'https://mjtbybqmlulkodtnhxln.supabase.co/rest/v1/courses?select=id&limit=1';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qdGJ5YnFtbHVsa29kdG5oeGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjUxNTYsImV4cCI6MjA5MDA0MTE1Nn0.VtJf0ZDF13gslPyRfdpAJtHR5deA-4pIHelx9-frr9I';

async function testVitals() {
  console.log('--- TESTING SUPABASE VITALS (Native Fetch) ---');
  try {
    const res = await fetch(supabaseUrl, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    
    if (res.ok) {
        const data = await res.json();
        console.log('SUCCESS: Connection to REST API working.');
        console.log('Sample Data:', data);
    } else {
        const text = await res.text();
        console.log('FAILED: status', res.status);
        console.log('Body:', text);
    }

    console.log('\n--- TESTING AUTH API ---');
    const authUrl = 'https://mjtbybqmlulkodtnhxln.supabase.co/auth/v1/token?grant_type=password';
    const authRes = await fetch(authUrl, {
        method: 'POST',
        headers: {
            'apikey': anonKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: 'karthikselvasiva16@gmail.com',
            password: 'Test@123'
        })
    });

    if (authRes.ok) {
        const authData = await authRes.json();
        console.log('SUCCESS: Auth Login REST working.');
        console.log('User ID:', authData.user.id);
    } else {
        const authErr = await authRes.json();
        console.log('FAILED: Auth login failed.', authRes.status);
        console.log('Error Details:', authErr);
    }

  } catch (err) {
    console.log('FATAL:', err.message);
  }
}

testVitals();
