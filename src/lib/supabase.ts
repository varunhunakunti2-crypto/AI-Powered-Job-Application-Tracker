import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY are missing.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Persists the session in localStorage on the client side
    autoRefreshToken: true,
  },
});
