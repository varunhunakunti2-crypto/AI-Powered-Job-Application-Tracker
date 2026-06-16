import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env['PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = env['PUBLIC_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = `test_${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  console.log('Signing up a test user:', email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Test Tester'
      }
    }
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError);
    return;
  }

  const user = signUpData.user;
  console.log('Sign up successful. User ID:', user?.id);

  // Now try to log in
  console.log('Logging in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Sign in failed:', signInError);
    return;
  }

  const session = signInData.session;
  // Create client with authenticated session
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  
  // Set the session manually
  await authClient.auth.setSession(session);

  console.log('Attempting profile select...');
  const { data: profile, error: selectError } = await authClient
    .from('profiles')
    .select('*')
    .eq('id', user.id);

  console.log('Select result:', profile, 'Error:', selectError);

  console.log('Attempting profile upsert...');
  const { data: upsertResult, error: upsertError } = await authClient
    .from('profiles')
    .upsert({
      id: user.id,
      target_role: 'Senior Developer',
      target_salary_min: 120000,
      target_salary_max: 150000,
      skills: ['JS', 'TS', 'React']
    })
    .select();

  console.log('Upsert result:', upsertResult, 'Error:', upsertError);
}

run();
