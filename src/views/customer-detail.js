import { createCrmActivity, listCrmActivities } from '../lib/crm-api.js';

export async function renderCustomerDetail(container, { supabase, customer, onBack }) {
  container.innerHTML = `<section class="page"><button class="back" id="back-customers">← Customers</button><header class="page-header"><div><p class="eyebrow">${customer.source.replaceAll('_', ' ')}</p><h1>${escapeHtml(customer.name)}</h1><p>${customer.status.replaceAll('_', ' ')}</p></div></header><section class="panel"><h2>CRM activity</h2><form id="activity-form" class="activity-form"><label>Topic<select name="topic"><option>Price / Negotiation</option><option>Product / Spec Requirement</option><option>New Order / Forecast</option><option>Shipment Concern</option><option>Payment / Finance</option><option>Other</option></select></label><label>Channel<select name="channel"><option>Email</option><option>Call</option><option>Meeting</option><option>LINE</option><option>WhatsApp</option><option>Other</option></select></label><label class="wide">Note<textarea name="note" required></textarea></label><button>Add activity</button></form><div id="activity-message" role="status"></div><ul id="activity-list" class="activity-list"><li>Loading activity history…</li></ul></section></section>`;
  container.querySelector('#back-customers').addEventListener('click', onBack);
  const list = container.querySelector('#activity-list');
  const message = container.querySelector('#activity-message');
  async function load() {
    try { const items = await listCrmActivities(supabase, customer.id); list.innerHTML = items.length ? items.map((item) => `<li><strong>${escapeHtml(item.topic)}</strong><span>${item.activity_date} · ${escapeHtml(item.channel)}</span><p>${escapeHtml(item.note)}</p></li>`).join('') : '<li>No activity recorded yet.</li>'; }
    catch (error) { message.textContent = `Could not load CRM activity: ${error.message}`; }
  }
  container.querySelector('#activity-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await createCrmActivity(supabase, customer.id, Object.fromEntries(form)); event.currentTarget.reset(); message.textContent = 'Activity added.'; await load(); } catch (error) { message.textContent = error.message; } });
  await load();
}
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
