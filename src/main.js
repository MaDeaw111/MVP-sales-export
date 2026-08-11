import './styles/app.css';
import { createConfiguredSupabaseClient } from './lib/supabase.js';
import { signInWithGoogle } from './lib/auth.js';
import { completeApprovedSession } from './lib/session.js';
import { renderCustomers } from './views/customers.js';
import { renderProducts } from './views/products.js';
import { renderShipmentConfigurations } from './views/shipment-configurations.js';
import { renderStandardPrices } from './views/standard-prices.js';
import { renderSpecialPrices } from './views/special-prices.js';

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

async function renderApp(supabase, profile) {
  app.innerHTML = `<div class="app-shell"><aside><p class="eyebrow">WCAT</p><h2>Sales Support</h2><nav><a href="#customers" class="active">Customers</a><a href="#crm">CRM & Actions</a><a href="#products">Products & Specs</a><a href="#configurations">Shipment Config</a><a href="#pricing">Pricing</a><a href="#special-prices">Special Price</a><a href="#po">Purchase Orders</a></nav><p class="hint">${profile.role}</p></aside><main id="content"></main></div>`;
  const content = document.querySelector('#content');
  const renderRoute = async () => {
    const route = location.hash || '#customers';
    app.querySelectorAll('nav a').forEach((link) => link.classList.toggle('active', link.hash === route));
    if (route === '#products') await renderProducts(content, { supabase, profile }); else if (route === '#configurations') await renderShipmentConfigurations(content, { supabase, profile }); else if (route === '#pricing') await renderStandardPrices(content, { supabase, profile }); else if (route === '#special-prices') await renderSpecialPrices(content, { supabase, profile }); else await renderCustomers(content, { supabase, profile });
  };
  window.addEventListener('hashchange', renderRoute);
  await renderRoute();
}

async function boot(supabase) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return renderSignIn(supabase);
  try { await renderApp(supabase, await completeApprovedSession(supabase)); }
  catch (error) { await supabase.auth.signOut(); renderError(error); }
}

try {
  boot(createConfiguredSupabaseClient());
} catch (error) {
  renderError(error);
}
