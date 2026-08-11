import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient({ url, anonKey } = {}) {
  if (!url) throw new Error('VITE_SUPABASE_URL is required');
  if (!anonKey) throw new Error('VITE_SUPABASE_ANON_KEY is required');
  return createClient(url, anonKey);
}

export function createConfiguredSupabaseClient() {
  return createSupabaseClient({
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  });
}
