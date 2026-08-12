import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderShipmentConfigurations } from '../../src/views/shipment-configurations.js';

it('hides Bags and shows direct MT when Admin selects Bulk Container', async () => {
  const dom = new JSDOM('<div id="app"></div>'); global.document = dom.window.document;
  const result = Promise.resolve({ data: [], error: null });
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: () => result }), order: () => ({ eq: () => result }) }) }) };
  await renderShipmentConfigurations(document.querySelector('#app'), { supabase, profile: { role: 'ADMIN' } });
  document.querySelector('#new-config').click();
  const packageType = document.querySelector('[name="packageType"]');
  packageType.value = 'BULK_CONTAINER';
  packageType.dispatchEvent(new dom.window.Event('change'));
  expect(document.querySelector('[name="bagsPerContainer"]')).toBeNull();
  expect(document.querySelector('[name="standardMt"]')).not.toBeNull();
});
