import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env manually since dotenv might not be in package.json
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

console.log('Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  try {
    const { data: users, error: userError } = await supabase.from('profiles').select('*');
    if (userError) {
      console.error('Error fetching profiles:', userError);
    } else {
      console.log('Profiles currently in DB:', users);
    }

    const { data: apps, error: appError } = await supabase.from('applications').select('*');
    if (appError) {
      console.error('Error fetching applications:', appError);
    } else {
      console.log('Applications currently in DB:', apps);
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
