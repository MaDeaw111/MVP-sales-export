import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderProducts } from '../../src/views/products.js';

it('shows approved technical limits as read-only to an Admin', async () => {
  const dom = new JSDOM('<div id="app"></div>');
  global.document = dom.window.document;
  const supabase = {
    from: () => ({ select: () => ({ order: () => Promise.resolve({
      data: [{ id: 'p1', code: 'PROD-001', name: 'Residue Pellet', description: 'Short name: TRP', remark: null, is_active: true,
        product_specs: [{ id: 's1', name: 'Residue Pellet', version: '1.0', status: 'APPROVED', parameters: { starch_min: 0.45, moisture_max: 0.14 }, note: null }] }], error: null }) }) })
  };
  await renderProducts(document.querySelector('#app'), { supabase, profile: { role: 'ADMIN' } });
  expect(document.body.textContent).toContain('Starch min: 45%');
  expect(document.body.textContent).toContain('Moisture max: 14%');
  document.querySelector('[data-product-id="p1"]').click();
  expect(document.body.textContent).toContain('Edit product master');
  expect(document.body.textContent).not.toContain('Edit technical limits');
  expect(document.querySelector('#derived-product-form textarea').readOnly).toBe(false);
});
