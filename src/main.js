import './styles/app.css';
import { createConfiguredSupabaseClient } from './lib/supabase.js';
import { signInWithGoogle } from './lib/auth.js';

const app = document.querySelector('#app');

function renderError(error) {
  app.innerHTML = `<main class="centered"><section class="card error"><h1>Configuration error</h1><p>${error.message}</p><p>Set the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment values before running the app.</p></section></main>`;
}

function renderSignIn(supabase) {
  app.innerHTML = `<main class="centered"><section class="card"><p class="eyebrow">WCAT</p><h1>Sales Support</h1><p>Sign in with your approved WCAT Google account.</p><button id="google-sign-in">Continue with Google</button><p class="hint">Access is granted only to active, pre-approved profiles.</p></section></main>`;
  document.querySelector('#google-sign-in').addEventListener('click', async () => {
    try { await signInWithGoogle(supabase); } catch (error) { renderError(error); }
  });
}

try {
  renderSignIn(createConfiguredSupabaseClient());
} catch (error) {
  renderError(error);
}
