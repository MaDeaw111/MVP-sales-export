import { createDirectCustomer, listCustomers } from '../lib/customers-api.js';

export async function renderCustomers(container, { supabase, profile }) {
  container.innerHTML = `<section class="page"><header class="page-header"><div><p class="eyebrow">CUSTOMERS</p><h1>Customer directory</h1><p>Only customers permitted by your role are shown.</p></div>${profile.role === 'EXTERNAL_SALES' ? '<a class="button" href="#first-po">New Customer + First PO</a>' : '<button id="new-customer">New Direct Customer</button>'}</header><div id="customer-message" role="status"></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Source</th><th>Status</th></tr></thead><tbody id="customer-rows"><tr><td colspan="3">Loading customers…</td></tr></tbody></table></div></section>`;
  const rows = container.querySelector('#customer-rows');
  const message = container.querySelector('#customer-message');
  async function load() {
    try {
      const customers = await listCustomers(supabase);
      rows.innerHTML = customers.length ? customers.map((customer) => `<tr><td>${escapeHtml(customer.name)}</td><td>${formatLabel(customer.source)}</td><td>${formatLabel(customer.status)}</td></tr>`).join('') : '<tr><td colspan="3">No customers are available for your role.</td></tr>';
    } catch (error) { message.textContent = `Could not load customers: ${error.message}`; }
  }
  container.querySelector('#new-customer')?.addEventListener('click', () => {
    message.innerHTML = `<form id="customer-form" class="inline-form"><label>Customer name<input name="name" required autocomplete="organization" /></label><button>Create Prospect</button></form>`;
    message.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      try { await createDirectCustomer(supabase, new FormData(event.currentTarget).get('name')); message.textContent = 'Direct WCAT prospect created.'; await load(); }
      catch (error) { message.textContent = error.message; }
    });
  });
  await load();
}

function formatLabel(value) { return value.replaceAll('_', ' '); }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
