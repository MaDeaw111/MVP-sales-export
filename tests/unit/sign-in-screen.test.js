import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithPassword: vi.fn(),
  getSession: vi.fn(),
  supabase: null,
}));

vi.mock('../../src/lib/auth.js', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
  signInWithPassword: mocks.signInWithPassword,
}));

vi.mock('../../src/lib/supabase.js', () => ({
  createConfiguredSupabaseClient: () => mocks.supabase,
}));

describe('sign-in screen', () => {
  beforeEach(() => {
    vi.resetModules();
    const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:5173' });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.location = dom.window.location;
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signInWithPassword.mockReset().mockResolvedValue(undefined);
    mocks.supabase = { auth: { getSession: mocks.getSession } };
  });

  async function loadSignInScreen() {
    await import('../../src/main.js');
    await vi.waitFor(() => expect(document.querySelector('form')).not.toBeNull());
  }

  it('submits email and password to Supabase Auth', async () => {
    await loadSignInScreen();
    const form = document.querySelector('form');
    const email = document.querySelector('input[name="email"]');
    const password = document.querySelector('input[name="password"]');

    expect(email).toMatchObject({ type: 'email', autocomplete: 'email' });
    expect(password).toMatchObject({ type: 'password', autocomplete: 'current-password' });

    email.value = 'sales@wcat.example';
    password.value = 'secret';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(mocks.signInWithPassword).toHaveBeenCalledWith(mocks.supabase, {
        email: 'sales@wcat.example',
        password: 'secret',
      });
    });
  });

  it('shows an authentication error without treating it as configuration failure', async () => {
    mocks.signInWithPassword.mockRejectedValueOnce(new Error('Invalid login credentials'));
    await loadSignInScreen();

    document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(document.querySelector('h1').textContent).toBe('Sign in failed'));
    expect(document.querySelector('#app').textContent).toContain('Invalid login credentials');
    expect(document.querySelector('#app').textContent).not.toContain('VITE_SUPABASE_URL');
  });
});
