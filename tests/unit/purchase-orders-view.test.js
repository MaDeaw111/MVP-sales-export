import { beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderPurchaseOrders } from '../../src/views/purchase-orders.js';

const products = [
  { id: 'p1', code: 'PROD-001', name: 'Tapioca Starch', is_active: true, product_specs: [
    { id: 's-approved', name: 'Food Grade', version: '1.0', status: 'APPROVED', parameters: {}, note: null },
    { id: 's-draft', name: 'Draft Grade', version: '1.0', status: 'DRAFT', parameters: {}, note: null },
  ] },
  { id: 'p2', code: 'PROD-002', name: 'Native Starch', is_active: true, product_specs: [
    { id: 's-second', name: 'Standard', version: '2.0', status: 'APPROVED', parameters: {}, note: null },
  ] },
  { id: 'p3', code: 'PROD-003', name: 'Inactive Product', is_active: false, product_specs: [] },
];

const configurations = [
  { id: 'jumbo-20', is_active: true, shipment_mode: 'Container', container_type: "20'", package: 'Jumbobag', package_type: 'JUMBOBAG', jumbobag_id: 'jumbo-850', bags_per_container: 20, standard_mt_per_container: 17, tolerance_percent: 2, jumbobag_master: { weight_kg: 850 } },
  { id: 'bag-25', is_active: true, shipment_mode: 'Container', container_type: "20'", package: 'Bag 25 kg', package_type: 'BAG_25KG', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: null, tolerance_percent: 0, jumbobag_master: null },
  { id: 'bulk-vessel', is_active: true, shipment_mode: 'Bulk Vessel', container_type: 'Vessel', package: 'Bulk', package_type: 'BULK', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: null, tolerance_percent: 0, jumbobag_master: null },
];

function createSupabase() {
  return {
    from(table) {
      if (table === 'products') return { select: () => ({ order: () => Promise.resolve({ data: products, error: null }) }) };
      if (table === 'shipment_configurations') return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: configurations, error: null }) }) }) };
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function change(select, value) {
  select.value = value;
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
}

describe('purchase order form selectors', () => {
  beforeEach(async () => {
    const dom = new JSDOM('<div id="app"></div>');
    global.document = dom.window.document;
    global.window = dom.window;
    await renderPurchaseOrders(document.querySelector('#app'), { supabase: createSupabase(), profile: { role: 'ADMIN' } });
  });

  it('renders dependent product, spec, and shipment type selectors', () => {
    expect(document.querySelector('select[name="productId"]')).not.toBeNull();
    expect(document.querySelector('select[name="specId"]')?.disabled).toBe(true);
    expect(document.querySelector('select[name="shipmentType"]')).not.toBeNull();
    expect(document.querySelector('#po-create')?.textContent).not.toContain('Shipment Configuration');
  });

  it('lists active products and only approved specs for the selected product', () => {
    const product = document.querySelector('select[name="productId"]');
    const spec = document.querySelector('select[name="specId"]');

    expect(product).not.toBeNull();
    expect(spec).not.toBeNull();
    expect([...product.options].map(({ textContent }) => textContent)).toContain('PROD-001 — Tapioca Starch');
    expect(product.textContent).not.toContain('Inactive Product');
    change(product, 'p1');
    expect(spec.disabled).toBe(false);
    expect([...spec.options].map(({ value }) => value)).toContain('s-approved');
    expect([...spec.options].map(({ value }) => value)).not.toContain('s-draft');

    spec.value = 's-approved';
    change(product, 'p2');
    expect(spec.value).toBe('');
    expect([...spec.options].map(({ value }) => value)).toContain('s-second');
  });

  it('resolves a completed Jumbobag selection and shows its fixed load', () => {
    const shipmentType = document.querySelector('select[name="shipmentType"]');
    expect(shipmentType).not.toBeNull();
    change(shipmentType, 'Container');
    change(document.querySelector('select[name="shipmentContainerType"]'), "20'");
    change(document.querySelector('select[name="shipmentPackageKey"]'), 'JUMBOBAG:Jumbobag:jumbo-850');
    change(document.querySelector('select[name="shipmentBagsPerContainer"]'), '20');

    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('jumbo-20');
    expect(document.querySelector('[name="shipmentPackageType"]').value).toBe('JUMBOBAG');
    expect(document.querySelector('#shipment-po-detail').textContent).toContain('MT / Container: 17');
    expect(document.querySelector('#shipment-po-detail').textContent).toContain('Tolerance: 2%');
  });

  it('shows integer Bags and a live calculated MT for Bag 25 kg', () => {
    const shipmentType = document.querySelector('select[name="shipmentType"]');
    expect(shipmentType).not.toBeNull();
    change(shipmentType, 'Container');
    change(document.querySelector('select[name="shipmentContainerType"]'), "20'");
    change(document.querySelector('select[name="shipmentPackageKey"]'), 'BAG_25KG:Bag 25 kg:');
    const bags = document.querySelector('input[name="shipmentBagsPerContainer"]');

    expect(bags.required).toBe(true);
    expect(bags.step).toBe('1');
    bags.value = '800';
    bags.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(document.querySelector('#shipment-po-detail').textContent).toContain('MT / Container: 20');
  });

  it('shows only required manual MT after a Bulk Vessel package is selected', () => {
    const shipmentType = document.querySelector('select[name="shipmentType"]');
    expect(shipmentType).not.toBeNull();
    change(shipmentType, 'Bulk Vessel');
    expect(document.querySelector('select[name="shipmentContainerType"]')).toBeNull();
    change(document.querySelector('select[name="shipmentPackageKey"]'), 'BULK:Bulk:');

    const detail = document.querySelector('#shipment-po-detail');
    expect(detail.querySelector('input[name="manualShipmentMt"]')?.required).toBe(true);
    expect(detail.querySelector('[name="shipmentBagsPerContainer"]')).toBeNull();
    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('bulk-vessel');
  });
});
