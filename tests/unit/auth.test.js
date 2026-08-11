import { describe, expect, it, vi } from 'vitest';
import { signInWithPassword } from '../../src/lib/auth.js';

describe('signInWithPassword', () => {
  it('requires an email address', async () => {
    await expect(signInWithPassword({ auth: {} }, { email: '', password: 'secret' }))
      .rejects.toThrow('Email is required');
  });

  it('requires a password', async () => {
    await expect(signInWithPassword({ auth: {} }, { email: 'sales@wcat.example', password: '' }))
      .rejects.toThrow('Password is required');
  });

  it('sends normalized credentials to Supabase Auth', async () => {
    const signInWithPasswordApi = vi.fn().mockResolvedValue({ error: null });

    await expect(signInWithPassword({ auth: { signInWithPassword: signInWithPasswordApi } }, {
      email: ' sales@wcat.example ',
      password: 'secret',
    })).resolves.toBeUndefined();

    expect(signInWithPasswordApi).toHaveBeenCalledWith({
      email: 'sales@wcat.example',
      password: 'secret',
    });
  });

  it('propagates Supabase authentication errors', async () => {
    const authError = new Error('Invalid login credentials');
    const signInWithPasswordApi = vi.fn().mockResolvedValue({ error: authError });

    await expect(signInWithPassword({ auth: { signInWithPassword: signInWithPasswordApi } }, {
      email: 'sales@wcat.example',
      password: 'wrong',
    })).rejects.toBe(authError);
  });
});
