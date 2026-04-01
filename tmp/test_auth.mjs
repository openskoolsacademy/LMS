import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Manually load .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('MISSING ENV VARS');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log('Testing connection to:', supabaseUrl);
  try {
    const { data, error } = await supabase.from('courses').select('count', { count: 'exact', head: true });
    if (error) {
      console.log('Supabase Connection Error:', error.message);
    } else {
      console.log('Connection Successful. Course count:', data);
    }

    console.log('Testing login for: karthikselvasiva16@gmail.com');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'karthikselvasiva16@gmail.com',
        password: 'Test@123'
    });

    if (authError) {
        console.log('Login Failed:', authError.message);
    } else {
        console.log('Login Successful! User ID:', authData.user.id);
        
        // Check if profile exists
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();
        
        if (profileError) {
            console.log('Profile Query Failed:', profileError.message);
        } else {
            console.log('Profile found:', profile.name, 'with role:', profile.role);
        }
    }

  } catch (err) {
    console.log('Fatal Error:', err.message);
  }
}

testLogin();
