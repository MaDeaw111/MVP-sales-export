import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderPurchaseOrders } from '../../src/views/purchase-orders.js';

it('renders a Shipment Configuration selector in the PO form', async () => {
  const dom = new JSDOM('<div id="app"></div>'); global.document = dom.window.document;
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) };
  await renderPurchaseOrders(document.querySelector('#app'), { supabase, profile: { role: 'ADMIN' } });
  expect(document.querySelector('[name="shipmentConfigurationId"]')).not.toBeNull();
});
