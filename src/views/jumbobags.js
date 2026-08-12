import { createJumbobag, listJumbobags, updateJumbobag } from '../lib/jumbobags-api.js';

export async function renderJumbobags(container, { supabase, profile }) {
  const isAdmin = profile?.role === 'ADMIN';
  container.innerHTML = `<section class="page"><header class="page-header"><div><p class="eyebrow">JUMBOBAG MASTER</p><h1>Jumbobag weights</h1><p>Create a new weight here before it can be selected for a Shipment Configuration.</p></div></header><div id="jumbobag-message" role="status"></div>${isAdmin ? '<section class="panel"><form id="jumbobag-form" class="inline-form"><label>Weight (kg)<input name="weightKg" type="number" min="1" step="0.001" required></label><label>Remark<input name="remark"></label><button>Add Jumbobag</button></form></section>' : ''}<div class="table-wrap"><table><thead><tr><th>Weight (kg)</th><th>Status</th><th>Remark</th></tr></thead><tbody id="jumbobag-rows"><tr><td colspan="3">Loading Jumbobags…</td></tr></tbody></table></div></section>`;
  const rows = container.querySelector('#jumbobag-rows'); const message = container.querySelector('#jumbobag-message');
  async function load() {
    try {
      const data = await listJumbobags(supabase, isAdmin);
      rows.innerHTML = data.length ? data.map((item) => `<tr><td>${item.weight_kg}</td><td>${item.is_active ? 'ACTIVE' : 'INACTIVE'}</td><td>${isAdmin ? `<form data-jumbobag-edit="${item.id}" class="inline-form"><input data-remark-id="${item.id}" name="remark" value="${escapeHtml(item.remark || '')}"><button class="link-button">Save</button>${item.is_active ? ` <button type="button" class="link-button" data-deactivate-id="${item.id}">Deactivate</button>` : ''}</form>` : escapeHtml(item.remark || '—')}</td></tr>`).join('') : '<tr><td colspan="3">No Jumbobag weights yet.</td></tr>';
      rows.querySelectorAll('[data-jumbobag-edit]').forEach((form) => form.addEventListener('submit', async (event) => { event.preventDefault(); try { await updateJumbobag(supabase, form.dataset.jumbobagEdit, { remark: new FormData(form).get('remark'), isActive: true }); message.textContent = 'Jumbobag updated.'; await load(); } catch (error) { message.textContent = error.message; } }));
      rows.querySelectorAll('[data-deactivate-id]').forEach((button) => button.addEventListener('click', async () => { try { await updateJumbobag(supabase, button.dataset.deactivateId, { remark: null, isActive: false }); message.textContent = 'Jumbobag deactivated.'; await load(); } catch (error) { message.textContent = error.message; } }));
    } catch (error) { message.textContent = error.message; }
  }
  container.querySelector('#jumbobag-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await createJumbobag(supabase, Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); message.textContent = 'Jumbobag added.'; await load(); } catch (error) { message.textContent = error.message; }
  });
  await load();
}

function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value ?? ''; return element.innerHTML; }
