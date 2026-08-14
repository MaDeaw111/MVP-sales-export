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
  { id: 'jumbo-20', is_active: true, shipment_mode: 'Container', container_type: '20', package: 'Jumbobag', package_type: 'JUMBOBAG', jumbobag_id: 'jumbo-850', bags_per_container: 20, standard_mt_per_container: 17, tolerance_percent: 2, jumbobag_master: { weight_kg: 850 } },
  { id: 'bag-25', is_active: true, shipment_mode: 'Container', container_type: '20', package: 'Bag 25 kg', package_type: 'BAG_25KG', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: null, tolerance_percent: 0, jumbobag_master: null },
  { id: 'bulk-liner', is_active: true, shipment_mode: 'Container', container_type: '20', package: 'Bulk Container + Liner', package_type: 'BULK_CONTAINER', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: 20, tolerance_percent: 5, jumbobag_master: null },
  { id: 'bulk-fixed', is_active: true, shipment_mode: 'Container', container_type: '20', package: 'Bulk Container', package_type: 'BULK_CONTAINER', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: 20, tolerance_percent: 5, jumbobag_master: null },
  { id: 'bulk-vessel', is_active: true, shipment_mode: 'Bulk Vessel', container_type: 'Vessel', package: 'Bulk', package_type: 'LEGACY', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: null, tolerance_percent: 0, jumbobag_master: null },
  { id: 'truck', is_active: true, shipment_mode: 'Truck', container_type: 'Truck', package: 'Bulk', package_type: 'LEGACY', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: null, tolerance_percent: 0, jumbobag_master: null },
];

const customers = [
  { id: 'customer-prospect', customer_code: 'CUST-001', name: 'Prospect Buyer', status: 'PROSPECT' },
  { id: 'customer-active', customer_code: 'CUST-002', name: 'Active Buyer', status: 'ACTIVE_CUSTOMER' },
  { id: 'customer-inactive', customer_code: 'CUST-003', name: 'Inactive Buyer', status: 'INACTIVE' },
  { id: 'customer-no-code', customer_code: '', name: 'Name Only Buyer', status: 'PROSPECT' },
];

function createSupabase(productData, configurationData, customerData) {
  const state = { purchaseOrderInserts: [] };
  return {
    state,
    supabase: {
      from(table) {
        if (table === 'products') return { select: () => ({ order: () => Promise.resolve({ data: productData, error: null }) }) };
        if (table === 'shipment_configurations') return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: configurationData, error: null }) }) }) };
        if (table === 'customers') return { select: () => ({ order: () => Promise.resolve(customerData) }) };
        if (table === 'purchase_orders') return { insert: (payload) => {
          state.purchaseOrderInserts.push(payload);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'po-created' }, error: null }) }) };
        } };
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc: () => Promise.resolve({ data: [{ decision: 'AUTO_PASS', reason: 'Test' }], error: null }),
    },
  };
}

async function renderFixture({ productData = products, configurationData = configurations, customerData = { data: customers, error: null } } = {}) {
  const dom = new JSDOM('<div id="app"></div>');
  global.document = dom.window.document;
  global.window = dom.window;
  global.FormData = dom.window.FormData;
  const fixture = createSupabase(productData, configurationData, customerData);
  await renderPurchaseOrders(document.querySelector('#app'), { supabase: fixture.supabase, profile: { role: 'ADMIN' } });
  return fixture.state;
}

function change(select, value) {
  select.value = value;
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function completeValidCreateForm({ customerId } = {}) {
  if (customerId) change(document.querySelector('select[name="customerId"]'), customerId);
  change(document.querySelector('select[name="productId"]'), 'p1');
  change(document.querySelector('select[name="specId"]'), 's-approved');
  change(document.querySelector('select[name="shipmentType"]'), 'Truck');
  change(document.querySelector('select[name="shipmentPackageKey"]'), 'LEGACY:Bulk:');
  document.querySelector('[name="manualShipmentMt"]').value = '500';
  document.querySelector('[name="number"]').value = 'PO-001';
  document.querySelector('[name="date"]').value = '2026-08-14';
  document.querySelector('[name="quantity"]').value = '500';
  document.querySelector('[name="destination"]').value = 'Bangkok';
  document.querySelector('[name="sellingPrice"]').value = '450';
}

async function submitCreateForm() {
  document.querySelector('#po-create').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('purchase order form selectors', () => {
  let state;

  beforeEach(async () => {
    state = await renderFixture();
  });

  it('renders dependent product, spec, and shipment type selectors', () => {
    expect(document.querySelector('select[name="productId"]')).not.toBeNull();
    expect(document.querySelector('select[name="specId"]')?.disabled).toBe(true);
    expect(document.querySelector('select[name="shipmentType"]')).not.toBeNull();
    expect(document.querySelector('#po-create')?.textContent).not.toContain('Shipment Configuration');
  });

  it('lists every customer directory entry as a selectable customer value', () => {
    const customer = document.querySelector('select[name="customerId"]');

    expect(customer?.disabled).toBe(false);
    expect([...customer.options].map(({ value, textContent }) => ({ value, label: textContent }))).toEqual(expect.arrayContaining([
      { value: 'customer-prospect', label: 'CUST-001 — Prospect Buyer' },
      { value: 'customer-active', label: 'CUST-002 — Active Buyer' },
      { value: 'customer-inactive', label: 'CUST-003 — Inactive Buyer' },
      { value: 'customer-no-code', label: 'Name Only Buyer' },
    ]));
    expect(document.querySelector('#po-create input[name="customerId"]')).toBeNull();
  });

  it('keeps customer selection disabled when the directory lookup fails', async () => {
    await renderFixture({ customerData: { data: null, error: new Error('Customer directory unavailable') } });

    const customer = document.querySelector('select[name="customerId"]');
    expect(customer?.disabled).toBe(true);
    expect(customer?.options[0]?.textContent).toBe('Customer directory unavailable');
    expect(document.querySelector('#po-create input[name="customerId"]')).toBeNull();
  });

  it('rejects PO creation when the customer directory lookup fails', async () => {
    state = await renderFixture({ customerData: { data: null, error: new Error('Customer directory unavailable') } });
    completeValidCreateForm();

    await submitCreateForm();

    expect(state.purchaseOrderInserts).toEqual([]);
    expect(document.querySelector('#po-result').textContent).toBe('Select a Customer');
  });

  it('rejects PO creation when the readable customer directory is empty', async () => {
    state = await renderFixture({ customerData: { data: [], error: null } });
    completeValidCreateForm();

    await submitCreateForm();

    expect(state.purchaseOrderInserts).toEqual([]);
    expect(document.querySelector('#po-result').textContent).toBe('Select a Customer');
  });

  it('submits the selected prospect customer ID when creating a purchase order', async () => {
    completeValidCreateForm({ customerId: 'customer-prospect' });

    await submitCreateForm();

    expect(state.purchaseOrderInserts).toHaveLength(1);
    expect(state.purchaseOrderInserts[0]).toMatchObject({ customer_id: 'customer-prospect' });
  });

  it("uses canonical container keys while displaying the 20-foot label", () => {
    change(document.querySelector('select[name="shipmentType"]'), 'Container');
    const containerType = document.querySelector('select[name="shipmentContainerType"]');

    expect([...containerType.options].map(({ value, textContent }) => ({ value, label: textContent })))
      .toContainEqual({ value: '20', label: "20'" });
  });

  it('lists active products and only approved specs for the selected product', () => {
    const product = document.querySelector('select[name="productId"]');
    const spec = document.querySelector('select[name="specId"]');

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

  it('renders hostile master-data labels as escaped option text', async () => {
    const hostileCustomerId = 'a19f23d0-7a00-4f47-a3fb-0123456789ab"><img id="customer-id-xss">';
    const hostileCustomerCode = '</option><img id="customer-code-xss">';
    const hostileCustomerName = '<svg id="customer-name-xss" onload="alert(1)">';
    const hostileProductId = 'p-hostile"><img id="product-id-xss">';
    const hostileProductCode = '</option><img id="product-xss">';
    const hostileSpecName = '</option><img id="spec-xss">';
    const hostilePackage = 'Bulk </option><img id="config-xss">';
    await renderFixture({
      productData: [{ id: hostileProductId, code: hostileProductCode, name: 'Safe Name', is_active: true, product_specs: [
        { id: 's-hostile', name: hostileSpecName, version: '1.0', status: 'APPROVED', parameters: {}, note: null },
      ] }],
      configurationData: [{ id: 'hostile-config', is_active: true, shipment_mode: 'Container', container_type: "40'", package: hostilePackage, package_type: 'BULK_CONTAINER', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: 20, tolerance_percent: 5, jumbobag_master: null }],
      customerData: { data: [{ id: hostileCustomerId, customer_code: hostileCustomerCode, name: hostileCustomerName, status: 'PROSPECT' }], error: null },
    });

    const customerOption = [...document.querySelector('select[name="customerId"]').options]
      .find(({ value }) => value === hostileCustomerId);
    expect(customerOption).toBeDefined();
    expect(customerOption.textContent).toBe(`${hostileCustomerCode} — ${hostileCustomerName}`);
    expect(customerOption.innerHTML).toContain('&lt;img');
    expect(customerOption.innerHTML).toContain('&lt;svg');
    expect(document.querySelector('#customer-code-xss, #customer-name-xss, #customer-id-xss')).toBeNull();

    const productOption = [...document.querySelector('select[name="productId"]').options].find(({ value }) => value === hostileProductId);
    expect(productOption).toBeDefined();
    expect(productOption.textContent).toBe(`${hostileProductCode} — Safe Name`);
    expect(productOption.innerHTML).toContain('&lt;img');
    expect(document.querySelector('#product-xss, #product-id-xss')).toBeNull();
    change(document.querySelector('select[name="productId"]'), hostileProductId);

    const specOption = document.querySelector('select[name="specId"] option[value="s-hostile"]');
    expect(specOption.textContent).toBe(`${hostileSpecName} — 1.0`);
    expect(specOption.innerHTML).toContain('&lt;img');
    expect(document.querySelector('#spec-xss')).toBeNull();

    change(document.querySelector('select[name="shipmentType"]'), 'Container');
    change(document.querySelector('select[name="shipmentContainerType"]'), "40'");
    const packageOption = [...document.querySelector('select[name="shipmentPackageKey"]').options]
      .find(({ value }) => value === `BULK_CONTAINER:${hostilePackage}:`);
    expect(packageOption.textContent).toBe(hostilePackage);
    expect(packageOption.innerHTML).toContain('&lt;img');
    expect(document.querySelector('#config-xss')).toBeNull();
  });

  it('resolves a completed Jumbobag selection and shows its fixed load', () => {
    change(document.querySelector('select[name="shipmentType"]'), 'Container');
    change(document.querySelector('select[name="shipmentContainerType"]'), '20');
    change(document.querySelector('select[name="shipmentPackageKey"]'), 'JUMBOBAG:Jumbobag:jumbo-850');
    change(document.querySelector('select[name="shipmentBagsPerContainer"]'), '20');

    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('jumbo-20');
    expect(document.querySelector('[name="shipmentPackageType"]').value).toBe('JUMBOBAG');
    expect(document.querySelector('#shipment-po-detail').textContent).toContain('MT / Container: 17');
    expect(document.querySelector('#shipment-po-detail').textContent).toContain('Tolerance: 2%');
  });

  it('resolves a fixed Bulk Container without Bags and shows MT and tolerance', () => {
    change(document.querySelector('select[name="shipmentType"]'), 'Container');
    change(document.querySelector('select[name="shipmentContainerType"]'), '20');
    change(document.querySelector('select[name="shipmentPackageKey"]'), 'BULK_CONTAINER:Bulk Container:');

    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('bulk-fixed');
    expect(document.querySelector('[name="shipmentPackageType"]').value).toBe('BULK_CONTAINER');
    expect(document.querySelector('[name="shipmentBagsPerContainer"]')).toBeNull();
    expect(document.querySelector('#shipment-po-detail').textContent).toContain('MT / Container: 20');
    expect(document.querySelector('#shipment-po-detail').textContent).toContain('Tolerance: 5%');
  });

  it('shows integer Bags and a live calculated MT for Bag 25 kg', () => {
    change(document.querySelector('select[name="shipmentType"]'), 'Container');
    change(document.querySelector('select[name="shipmentContainerType"]'), '20');
    change(document.querySelector('select[name="shipmentPackageKey"]'), 'BAG_25KG:Bag 25 kg:');
    const bags = document.querySelector('input[name="shipmentBagsPerContainer"]');

    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('bag-25');
    expect(bags.required).toBe(true);
    expect(bags.step).toBe('1');
    bags.value = '800';
    bags.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(document.querySelector('#shipment-po-detail').textContent).toContain('MT / Container: 20');
  });

  it('resolves Truck and shows only required manual MT', () => {
    change(document.querySelector('select[name="shipmentType"]'), 'Truck');
    expect(document.querySelector('select[name="shipmentContainerType"]')).toBeNull();
    change(document.querySelector('select[name="shipmentPackageKey"]'), 'LEGACY:Bulk:');

    const detail = document.querySelector('#shipment-po-detail');
    expect(detail.querySelector('input[name="manualShipmentMt"]')?.required).toBe(true);
    expect(detail.querySelector('[name="shipmentBagsPerContainer"]')).toBeNull();
    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('truck');
    expect(document.querySelector('[name="shipmentPackageType"]').value).toBe('LEGACY');
  });

  it('clears resolved hidden state after every upstream shipment change', () => {
    const shipmentType = document.querySelector('select[name="shipmentType"]');
    change(shipmentType, 'Truck');
    change(document.querySelector('select[name="shipmentPackageKey"]'), 'LEGACY:Bulk:');
    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('truck');

    change(shipmentType, 'Container');
    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('');
    expect(document.querySelector('[name="shipmentPackageType"]').value).toBe('');
    expect(document.querySelector('[name="manualShipmentMt"]')).toBeNull();

    const containerType = document.querySelector('select[name="shipmentContainerType"]');
    change(containerType, '20');
    const packageSelect = document.querySelector('select[name="shipmentPackageKey"]');
    change(packageSelect, 'BULK_CONTAINER:Bulk Container:');
    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('bulk-fixed');

    change(packageSelect, '');
    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('');
    expect(document.querySelector('[name="shipmentPackageType"]').value).toBe('');

    change(packageSelect, 'JUMBOBAG:Jumbobag:jumbo-850');
    const bags = document.querySelector('select[name="shipmentBagsPerContainer"]');
    change(bags, '20');
    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('jumbo-20');
    change(bags, '');
    expect(document.querySelector('[name="shipmentConfigurationId"]').value).toBe('');
    expect(document.querySelector('[name="shipmentPackageType"]').value).toBe('');

    change(containerType, '');
    expect(document.querySelector('select[name="shipmentPackageKey"]')).toBeNull();
  });

  it('rejects an ambiguous selection at submit even when hidden state is stale', async () => {
    state = await renderFixture({ configurationData: [
      ...configurations,
      { ...configurations.find(({ id }) => id === 'bulk-vessel'), id: 'bulk-vessel-duplicate' },
    ] });
    change(document.querySelector('select[name="customerId"]'), 'customer-prospect');
    change(document.querySelector('select[name="shipmentType"]'), 'Bulk Vessel');
    change(document.querySelector('select[name="shipmentPackageKey"]'), 'LEGACY:Bulk:');
    document.querySelector('[name="manualShipmentMt"]').value = '500';
    document.querySelector('[name="shipmentConfigurationId"]').value = 'stale-config';
    document.querySelector('[name="shipmentPackageType"]').value = 'LEGACY';

    document.querySelector('#po-create').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.purchaseOrderInserts).toEqual([]);
    expect(document.querySelector('#po-result').textContent).toBe('Select a valid shipment configuration');
  });
});
