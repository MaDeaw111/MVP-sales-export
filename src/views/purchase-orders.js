import { approvePurchaseOrderFx, createPurchaseOrder, evaluatePurchaseOrder } from '../lib/purchase-orders-api.js';
import { listCustomers } from '../lib/customers-api.js';
import { uploadNewPoDocument } from '../lib/po-documents.js';
import { listProductSpecs } from '../lib/products-api.js';
import { listShipmentConfigurations } from '../lib/shipment-configurations-api.js';
import { calculateBaggedMt } from '../lib/shipment-load-calculations.js';
import {
  listBagOptions,
  listContainerTypes,
  listPackages,
  listShipmentTypes,
  resolveShipmentConfiguration,
} from '../lib/po-form-options.js';

function setSelectOptions(select, placeholder, options) {
  select.replaceChildren();
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  select.append(placeholderOption);
  for (const { value, label, packageType } of options) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = String(label);
    if (packageType) option.dataset.packageType = String(packageType);
    select.append(option);
  }
}

export async function renderPurchaseOrders(container, { supabase, profile }) {
  let customers = [];
  let customerDirectoryAvailable = true;
  let products = [];
  let configurations = [];
  try { customers = await listCustomers(supabase); } catch { customerDirectoryAvailable = false; }
  try { products = await listProductSpecs(supabase); } catch { /* The commercial form remains available if product master data cannot load. */ }
  try { configurations = await listShipmentConfigurations(supabase); } catch { /* The commercial form remains available if shipment master data cannot load. */ }

  container.innerHTML = `<section class="page"><header class="page-header"><div><p class="eyebrow">PURCHASE ORDERS</p><h1>Commercial review</h1><p>Commercial decisions are calculated by the database from saved PO snapshots.</p></div></header><section class="panel"><h2>New PO</h2><form id="po-create" class="activity-form"><label>Customer<select name="customerId" required disabled></select></label><label>PO number<input name="number" required></label><label>PO date<input name="date" type="date" required></label><label>Product<select name="productId" required></select></label><label>Spec<select name="specId" required disabled><option value="">Select Product first</option></select></label><label>Shipment Type<select name="shipmentType" required></select></label><div id="shipment-container-selector"></div><div id="shipment-package-selector"></div><div id="shipment-bags-selector"></div><input type="hidden" name="shipmentConfigurationId"><input type="hidden" name="shipmentPackageType"><div id="shipment-po-detail" class="wide"></div><label>Quantity MT<input name="quantity" type="number" required></label><label>Incoterm<select name="incoterm"><option>FOB</option><option>CIF</option><option>CNF</option></select></label><label>Destination<input name="destination" required></label><label>Currency<select name="currency"><option>USD</option><option>EUR</option><option>THB</option></select></label><label>Selling price / MT<input name="sellingPrice" type="number" required></label><label>Commission USD/MT<input name="commission" type="number" value="0"></label><label>Freight snapshot USD/MT<input name="freightSnapshot" type="number"></label><label>FX rate<input name="fxRate" type="number" step="0.000001"></label><label>FX bank<input name="fxBank"></label><label>FX rate date<input name="fxDate" type="date"></label><button>Create & evaluate</button></form></section><section class="panel"><h2>Customer PO document</h2><form id="po-upload" class="inline-form"><label>Customer ID<input name="customerId" required></label><label>PO ID<input name="poId" required></label><label>File<input name="file" type="file" required accept=".pdf,.doc,.docx,.xlsx,.xls"></label><button>Upload private document</button></form></section><section class="panel"><form id="po-evaluate" class="inline-form"><label>Purchase Order ID<input name="purchaseOrderId" required></label><button>Evaluate commercial decision</button></form><div id="po-result" role="status"></div></section>${['MANAGEMENT', 'ADMIN'].includes(profile.role) ? '<section class="panel"><h2>Approve PO FX</h2><form id="fx-approve" class="inline-form"><label>PO ID<input name="poId" required></label><label>FX rate<input name="rate" type="number" step="0.000001" required></label><label>Bank<input name="bank" required></label><label>Rate date<input name="date" type="date" required></label><button>Approve FX</button></form></section>' : ''}</section>`;

  const result = container.querySelector('#po-result');
  const form = container.querySelector('#po-create');
  const containerSelector = container.querySelector('#shipment-container-selector');
  const packageSelector = container.querySelector('#shipment-package-selector');
  const bagsSelector = container.querySelector('#shipment-bags-selector');
  const shipmentDetail = container.querySelector('#shipment-po-detail');

  setSelectOptions(form.elements.customerId, customerDirectoryAvailable ? 'Select Customer' : 'Customer directory unavailable', customers
    .map((customer) => ({ value: customer.id, label: customer.customer_code ? `${customer.customer_code} — ${customer.name}` : customer.name })));
  form.elements.customerId.disabled = !customerDirectoryAvailable || customers.length === 0;
  setSelectOptions(form.elements.productId, 'Select Product', products.filter((product) => product.is_active !== false)
    .map((product) => ({ value: product.id, label: `${product.code} — ${product.name}` })));
  setSelectOptions(form.elements.shipmentType, 'Select Shipment Type', listShipmentTypes(configurations));

  form.elements.productId.addEventListener('change', (event) => {
    const product = products.find((item) => item.id === event.target.value && item.is_active !== false);
    const specs = (product?.product_specs ?? []).filter((spec) => spec.status === 'APPROVED');
    setSelectOptions(form.elements.specId, product ? 'Select Spec' : 'Select Product first',
      specs.map((spec) => ({ value: spec.id, label: `${spec.name} — ${spec.version}` })));
    form.elements.specId.disabled = specs.length === 0;
  });

  function clearResolvedShipment() {
    form.elements.shipmentConfigurationId.value = '';
    form.elements.shipmentPackageType.value = '';
    shipmentDetail.innerHTML = '';
  }

  function currentShipmentSelection() {
    return {
      shipmentType: form.elements.shipmentType.value,
      containerType: form.elements.shipmentContainerType?.value ?? '',
      packageKey: form.elements.shipmentPackageKey?.value ?? '',
      bagsPerContainer: form.elements.shipmentBagsPerContainer?.value ?? '',
    };
  }

  function setResolvedShipment(configuration) {
    form.elements.shipmentConfigurationId.value = configuration?.id ?? '';
    form.elements.shipmentPackageType.value = configuration?.package_type ?? '';
  }

  function showFixedLoad(configuration) {
    if (!configuration) return;
    const tolerance = configuration.tolerance_percent == null ? '—' : `${configuration.tolerance_percent}%`;
    const detail = document.createElement('p');
    detail.textContent = `MT / Container: ${configuration.standard_mt_per_container ?? '—'} | Tolerance: ${tolerance}`;
    shipmentDetail.replaceChildren(detail);
  }

  function renderPackageSelection() {
    clearResolvedShipment();
    bagsSelector.innerHTML = '';
    const { shipmentType, containerType } = currentShipmentSelection();
    const packageOptions = listPackages(configurations, shipmentType, containerType);
    packageSelector.innerHTML = '<label>Package<select name="shipmentPackageKey" required></select></label>';
    setSelectOptions(form.elements.shipmentPackageKey, 'Select Package', packageOptions);
    form.elements.shipmentPackageKey.addEventListener('change', renderPackageDetails);
  }

  function renderPackageDetails() {
    clearResolvedShipment();
    bagsSelector.innerHTML = '';
    const packageOption = form.elements.shipmentPackageKey.selectedOptions[0];
    const packageType = packageOption?.dataset.packageType ?? '';
    if (!packageOption?.value) return;

    const selection = currentShipmentSelection();
    if (packageType === 'JUMBOBAG') {
      const bagOptions = listBagOptions(configurations, selection);
      bagsSelector.innerHTML = '<label>No. of Bags<select name="shipmentBagsPerContainer" required></select></label>';
      setSelectOptions(form.elements.shipmentBagsPerContainer, 'Select Bags', bagOptions);
      form.elements.shipmentBagsPerContainer.addEventListener('change', () => {
        const configuration = resolveShipmentConfiguration(configurations, currentShipmentSelection());
        setResolvedShipment(configuration);
        shipmentDetail.innerHTML = '';
        showFixedLoad(configuration);
      });
      return;
    }

    const configuration = resolveShipmentConfiguration(configurations, selection);
    setResolvedShipment(configuration);
    if (packageType === 'BAG_25KG') {
      shipmentDetail.innerHTML = '<label>No. of Bags<input name="shipmentBagsPerContainer" type="number" min="1" step="1" required></label><p id="shipment-mt-preview"></p>';
      shipmentDetail.querySelector('input').addEventListener('input', (event) => {
        const bags = Number(event.target.value);
        shipmentDetail.querySelector('#shipment-mt-preview').textContent = Number.isInteger(bags) && bags > 0 ? `MT / Container: ${calculateBaggedMt(25, bags)}` : '';
      });
    } else if (selection.shipmentType === 'Bulk Vessel' || selection.shipmentType === 'Truck') {
      shipmentDetail.innerHTML = '<label>MT / Shipment<input name="manualShipmentMt" type="number" min="0.001" step="0.001" required></label>';
    } else {
      showFixedLoad(configuration);
    }
  }

  form.elements.shipmentType.addEventListener('change', () => {
    clearResolvedShipment();
    containerSelector.innerHTML = '';
    packageSelector.innerHTML = '';
    bagsSelector.innerHTML = '';
    const shipmentType = form.elements.shipmentType.value;
    if (!shipmentType) return;
    if (shipmentType === 'Container') {
      const containerOptions = listContainerTypes(configurations, shipmentType);
      containerSelector.innerHTML = '<label>Container Type<select name="shipmentContainerType" required></select></label>';
      setSelectOptions(form.elements.shipmentContainerType, 'Select Container Type', containerOptions);
      form.elements.shipmentContainerType.addEventListener('change', () => {
        clearResolvedShipment();
        packageSelector.innerHTML = '';
        bagsSelector.innerHTML = '';
        if (form.elements.shipmentContainerType.value) renderPackageSelection();
        else clearResolvedShipment();
      });
    } else {
      renderPackageSelection();
    }
  });

  async function evaluate(id) {
    const decision = await evaluatePurchaseOrder(supabase, id);
    result.innerHTML = `<strong>${decision.decision}</strong><p>${decision.reason}</p><p>Standard FOB: ${decision.standard_fob_usd_mt ?? '—'} | FOB Equivalent: ${decision.fob_equivalent_usd_mt ?? '—'}</p>`;
  }

  container.querySelector('#po-evaluate').addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await evaluate(new FormData(event.currentTarget).get('purchaseOrderId')); } catch (error) { result.textContent = error.message; }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      if (form.elements.customerId.disabled || !form.elements.customerId.value) {
        throw new Error('Select a Customer');
      }
      const configuration = resolveShipmentConfiguration(configurations, currentShipmentSelection());
      if (!configuration
        || form.elements.shipmentConfigurationId.value !== configuration.id
        || form.elements.shipmentPackageType.value !== configuration.package_type) {
        throw new Error('Select a valid shipment configuration');
      }
      const po = await createPurchaseOrder(supabase, Object.fromEntries(new FormData(form)));
      await evaluate(po.id);
    } catch (error) { result.textContent = error.message; }
  });
  container.querySelector('#po-upload').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try { await uploadNewPoDocument(supabase, { customerId: data.get('customerId'), poId: data.get('poId'), file: data.get('file') }); result.textContent = 'Customer PO document uploaded securely.'; } catch (error) { result.textContent = error.message; }
  });
  container.querySelector('#fx-approve')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try { await approvePurchaseOrderFx(supabase, data.get('poId'), data.get('rate'), data.get('bank'), data.get('date')); result.textContent = 'FX approved. Re-evaluate the PO to refresh its commercial decision.'; } catch (error) { result.textContent = error.message; }
  });
}
