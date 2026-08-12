import { createProductFromSpec, listProductSpecs, updateProductMaster } from '../lib/products-api.js';

const labels = { starch_min: 'Starch min', moisture_max: 'Moisture max', sand_silica_max: 'Sand / Silica max', crude_fiber_max: 'Crude fiber max', crude_protein: 'Crude protein', crude_fat_max: 'Crude fat max', ash_max: 'Ash max' };

export async function renderProducts(container, { supabase, profile }) {
  container.innerHTML = `<section class="page"><header class="page-header"><div><p class="eyebrow">PRODUCTS & SPECS</p><h1>Product master</h1><p>Approved technical limits are fixed. A technical change requires a new product code.</p></div></header><div id="product-message" role="status"></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Short name</th><th>Approval</th><th>Technical limits</th></tr></thead><tbody id="product-rows"><tr><td colspan="5">Loading products…</td></tr></tbody></table></div><div id="product-detail"></div></section>`;
  const rows = container.querySelector('#product-rows'); const message = container.querySelector('#product-message'); const detail = container.querySelector('#product-detail');
  let products = [];
  async function load() {
    try {
      products = await listProductSpecs(supabase);
      rows.innerHTML = products.length ? products.map((product) => {
        const spec = product.product_specs?.find((item) => item.status === 'APPROVED') || product.product_specs?.[0];
        return `<tr><td>${escapeHtml(product.code)}</td><td><button class="link-button" data-product-id="${product.id}">${escapeHtml(product.name)}</button></td><td>${escapeHtml(shortName(product.description))}</td><td>${spec ? `${escapeHtml(spec.status)} ${escapeHtml(spec.version)}` : '—'}</td><td>${escapeHtml(summary(spec?.parameters))}</td></tr>`;
      }).join('') : '<tr><td colspan="5">No products yet.</td></tr>';
      rows.querySelectorAll('[data-product-id]').forEach((button) => button.addEventListener('click', () => showDetail(products.find((product) => product.id === button.dataset.productId))));
    } catch (error) { message.textContent = `Could not load products: ${error.message}`; }
  }
  function showDetail(product) {
    const spec = product.product_specs?.find((item) => item.status === 'APPROVED') || product.product_specs?.[0];
    const technical = Object.entries(spec?.parameters || {}).filter(([key, value]) => key !== 'short_name' && value !== null && value !== undefined).map(([key, value]) => `<li><strong>${labels[key] || key}:</strong> ${percent(value)}</li>`).join('') || '<li>No technical limits recorded.</li>';
    const editable = profile?.role === 'ADMIN' ? `<section class="panel"><h2>Edit product master</h2><form id="product-edit-form" class="activity-form"><label>Name<input name="name" required value="${escapeHtml(product.name)}"></label><label>Short name<input name="shortName" required value="${escapeHtml(shortName(product.description))}"></label><label class="wide">Remark<textarea name="remark">${escapeHtml(product.remark || '')}</textarea></label><button>Save product</button></form></section><section class="panel"><h2>Create new product from this spec</h2><p>A changed technical limit is a new product. The existing approved spec remains unchanged.</p><form id="derived-product-form" class="activity-form"><label>New product code<input name="code" required></label><label>Product name<input name="name" required value="${escapeHtml(product.name)}"></label><label>Short name<input name="shortName" required value="${escapeHtml(shortName(product.description))}"></label><label class="wide">Technical limits for the new product (JSON)<textarea name="parameters" required>${escapeHtml(JSON.stringify(spec?.parameters || {}, null, 2))}</textarea></label><button>Create approved product</button></form></section>` : '';
    detail.innerHTML = `<section class="panel"><h2>${escapeHtml(product.code)} — ${escapeHtml(product.name)}</h2><p>Approved specification: ${spec ? `${escapeHtml(spec.name)} (${escapeHtml(spec.version)})` : 'not created'}</p><h3>Technical limits</h3><ul class="activity-list">${technical}</ul></section>${editable}`;
    detail.querySelector('#product-edit-form')?.addEventListener('submit', async (event) => { event.preventDefault(); try { await updateProductMaster(supabase, product.id, Object.fromEntries(new FormData(event.currentTarget))); message.textContent = 'Product master updated.'; await load(); showDetail((await listProductSpecs(supabase)).find((item) => item.id === product.id)); } catch (error) { message.textContent = error.message; } });
    detail.querySelector('#derived-product-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { const parameters = JSON.parse(values.parameters); if (!parameters || Array.isArray(parameters) || typeof parameters !== 'object') throw new Error('Technical limits must be a JSON object'); await createProductFromSpec(supabase, { code: values.code, name: values.name, shortName: values.shortName, parameters, note: `Derived from ${product.code}` }); message.textContent = `Created ${values.code} with an approved specification.`; await load(); } catch (error) { message.textContent = error.message; } });
  }
  await load();
}

function shortName(description = '') { return description.replace(/^Short name:\s*/i, '') || '—'; }
function percent(value) { return typeof value === 'number' ? `${Math.round(value * 10000) / 100}%` : String(value); }
function summary(parameters = {}) { return Object.entries(parameters).filter(([key, value]) => key !== 'short_name' && value !== null && value !== undefined).slice(0, 3).map(([key, value]) => `${labels[key] || key}: ${percent(value)}`).join(' · ') || '—'; }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value ?? ''; return element.innerHTML; }
