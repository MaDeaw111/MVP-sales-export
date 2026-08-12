import { createShipmentConfiguration, listShipmentConfigurations } from '../lib/shipment-configurations-api.js';
import { listJumbobags } from '../lib/jumbobags-api.js';
import { calculateBaggedMt, configurationFieldMode } from '../lib/shipment-load-calculations.js';

const bagCounts = [20, 27, 28, 29, 30];

export async function renderShipmentConfigurations(container, { supabase, profile }) {
  const isAdmin = profile?.role === 'ADMIN';
  container.innerHTML = `<section class="page"><header class="page-header"><div><p class="eyebrow">SHIPMENT CONFIGURATION</p><h1>Container loads</h1><p>Use standard container, package, and loading formats for consistent reporting.</p></div>${isAdmin ? '<button id="new-config">New Configuration</button>' : ''}</header><div id="config-message" role="status"></div><div id="config-editor"></div><div class="table-wrap"><table><thead><tr><th>Container</th><th>Package</th><th>Jumbobag</th><th>Bags</th><th>MT / Container</th><th>Tolerance</th></tr></thead><tbody id="config-rows"><tr><td colspan="6">Loading configurations…</td></tr></tbody></table></div></section>`;
  const rows = container.querySelector('#config-rows'); const message = container.querySelector('#config-message'); const editor = container.querySelector('#config-editor');
  let jumbobags = [];
  async function load() {
    try {
      const configs = await listShipmentConfigurations(supabase, { includeInactive: isAdmin });
      jumbobags = await listJumbobags(supabase);
      rows.innerHTML = configs.length ? configs.map((config) => `<tr><td>${escapeHtml(config.container_type)}</td><td>${escapeHtml(config.package)}</td><td>${config.jumbobag_master?.weight_kg ? `${config.jumbobag_master.weight_kg} kg` : '—'}</td><td>${config.bags_per_container ?? '—'}</td><td>${config.standard_mt_per_container ?? 'Set on PO'}</td><td>${config.tolerance_percent ? `${config.tolerance_percent}%` : '—'}</td></tr>`).join('') : '<tr><td colspan="6">No configurations yet.</td></tr>';
    } catch (error) { message.textContent = `Could not load configurations: ${error.message}`; }
  }
  function showEditor() {
    editor.innerHTML = `<section class="panel"><form id="config-form" class="activity-form"><label>Container Type<select name="containerType"><option value="20">20'</option><option value="40">40'</option><option value="40HQ">40HQ</option></select></label><label>Package<select name="packageType"><option value="JUMBOBAG">Jumbobag</option><option value="BAG_25KG">Bag 25 kg</option><option value="BULK_CONTAINER">Bulk Container</option></select></label><div id="config-dependent" class="wide"></div><button>Create configuration</button></form></section>`;
    const form = editor.querySelector('#config-form'); const dependent = editor.querySelector('#config-dependent');
    function renderDependent() {
      const packageType = form.elements.packageType.value; const mode = configurationFieldMode(packageType);
      if (mode.showJumbobag) {
        if (!jumbobags.length) { dependent.innerHTML = '<p>Add an active Jumbobag Master record before creating a Jumbobag configuration.</p>'; return; }
        const selectedWeight = Number(jumbobags[0]?.weight_kg || 0); const selectedBags = bagCounts[0];
        dependent.innerHTML = `<div class="activity-form"><label>Jumbobag<select name="jumbobagId">${jumbobags.map((item) => `<option value="${item.id}" data-weight="${item.weight_kg}">${item.weight_kg} kg</option>`).join('')}</select></label><label>No. of Bags<select name="bagsPerContainer">${bagCounts.map((count) => `<option value="${count}">${count} Bags</option>`).join('')}</select></label><label>MT / Container<input name="calculatedMt" readonly value="${calculateBaggedMt(selectedWeight, selectedBags)}"></label></div>`;
        const refreshMt = () => { const option = dependent.querySelector('[name="jumbobagId"] option:checked'); dependent.querySelector('[name="calculatedMt"]').value = calculateBaggedMt(Number(option.dataset.weight), Number(dependent.querySelector('[name="bagsPerContainer"]').value)); };
        dependent.querySelector('[name="jumbobagId"]').addEventListener('change', refreshMt); dependent.querySelector('[name="bagsPerContainer"]').addEventListener('change', refreshMt);
      } else if (mode.mtEditable) dependent.innerHTML = '<div class="activity-form"><label>MT / Container<input name="standardMt" type="number" min="0.001" step="0.001" required></label><label>Tolerance %<input name="tolerancePercent" type="number" min="0" step="0.01" value="0"></label></div>';
      else dependent.innerHTML = '<p>Bag 25 kg has no fixed bag count. Enter the number of bags when creating the Purchase Order; the system will calculate MT automatically.</p>';
    }
    form.elements.packageType.addEventListener('change', renderDependent); renderDependent();
    form.addEventListener('submit', async (event) => { event.preventDefault(); try { await createShipmentConfiguration(supabase, Object.fromEntries(new FormData(form))); editor.innerHTML = ''; message.textContent = 'Shipment configuration created.'; await load(); } catch (error) { message.textContent = error.message; } });
  }
  container.querySelector('#new-config')?.addEventListener('click', showEditor);
  await load();
}

function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value ?? ''; return element.innerHTML; }
