import './styles/app.css';
import { createConfiguredSupabaseClient } from './lib/supabase.js';
import { signInWithGoogle } from './lib/auth.js';
import { completeApprovedSession } from './lib/session.js';

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

function renderApp(profile) {
  app.innerHTML = `<main class="centered"><section class="card"><p class="eyebrow">WCAT • ${profile.role}</p><h1>Sales Support</h1><p>Approved access for ${profile.email}.</p><p class="hint">Customer, CRM, Pricing, and PO modules are protected by Supabase RLS.</p></section></main>`;
}

async function boot(supabase) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return renderSignIn(supabase);
  try { renderApp(await completeApprovedSession(supabase)); }
  catch (error) { await supabase.auth.signOut(); renderError(error); }
}

try {
  boot(createConfiguredSupabaseClient());
} catch (error) {
  renderError(error);
}
