import { describe, expect, it } from 'vitest';
import { createSupabaseClient } from '../../src/lib/supabase.js';

describe('createSupabaseClient', () => {
  it('rejects a missing Supabase URL', () => {
    expect(() => createSupabaseClient({ anonKey: 'public-key' })).toThrow(
      'VITE_SUPABASE_URL is required',
    );
  });

  it('rejects a missing Supabase anonymous key', () => {
    expect(() => createSupabaseClient({ url: 'https://example.supabase.co' })).toThrow(
      'VITE_SUPABASE_ANON_KEY is required',
    );
  });
});
