import { describe, expect, it } from 'vitest';
import { approvePurchaseOrderFx, createPurchaseOrder, evaluatePurchaseOrder, validateShipmentSelection } from '../../src/lib/purchase-orders-api.js';

const fixedPoValues = {
  customerId: 'c1',
  number: 'PO-1',
  date: '2026-08-11',
  productId: 'p1',
  specId: 's1',
  shipmentType: 'Container',
  shipmentPackageType: 'BULK_CONTAINER',
  shipmentConfigurationId: 'cfg-fixed',
  quantity: 100,
  incoterm: 'FOB',
  destination: 'Bangkok',
  currency: 'USD',
  sellingPrice: 500,
  commission: 20,
};

function insertRecorder() {
  const state = { inserts: [] };
  const supabase = {
    from: () => ({
      insert: (input) => {
        state.inserts.push(input);
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'po-1' }, error: null }) }) };
      },
    }),
  };
  return { state, supabase };
}

describe('purchase orders API', () => {
  it('evaluates a saved PO through the canonical database RPC', async () => {
    let args;
    const supabase = { rpc: (name, value) => { args = { name, value }; return Promise.resolve({ data: [{ decision: 'AUTO_PASS' }], error: null }); } };
    await expect(evaluatePurchaseOrder(supabase, 'po-1')).resolves.toEqual({ decision: 'AUTO_PASS' });
    expect(args).toEqual({ name: 'evaluate_po_commercial', value: { p_po_id: 'po-1' } });
  });

  it('sends the exact fixed Container payload without manual shipment MT', async () => {
    const { state, supabase } = insertRecorder();
    await createPurchaseOrder(supabase, fixedPoValues);

    expect(state.inserts[0]).toEqual({
      customer_id: 'c1',
      customer_po_number: 'PO-1',
      po_date: '2026-08-11',
      product_id: 'p1',
      product_spec_id: 's1',
      shipment_configuration_id: 'cfg-fixed',
      shipment_bags_per_container: null,
      contract_quantity_mt: 100,
      incoterm: 'FOB',
      destination: 'Bangkok',
      currency: 'USD',
      final_selling_price: 500,
      commission_usd_mt: 20,
      freight_snapshot_usd_mt: null,
      fx_rate: null,
      fx_bank_name: null,
      fx_rate_date: null,
    });
  });

  it('stores manual MT per shipment for a Bulk Vessel PO', async () => {
    const { state, supabase } = insertRecorder();
    await createPurchaseOrder(supabase, {
      ...fixedPoValues,
      number: 'PO-2',
      shipmentType: 'Bulk Vessel',
      shipmentPackageType: 'LEGACY',
      shipmentConfigurationId: 'cfg-vessel',
      manualShipmentMt: '500',
      quantity: 500,
    });
    expect(state.inserts[0].shipment_mt_per_container).toBe(500);
  });

  it('rejects unresolved shipment hidden state without inserting', async () => {
    for (const hiddenState of [
      { shipmentConfigurationId: '', shipmentPackageType: 'BULK_CONTAINER' },
      { shipmentConfigurationId: 'cfg-fixed', shipmentPackageType: '' },
    ]) {
      const { state, supabase } = insertRecorder();
      await expect(createPurchaseOrder(supabase, { ...fixedPoValues, ...hiddenState }))
        .rejects.toThrow('Shipment configuration and package are required');
      expect(state.inserts).toEqual([]);
    }
  });

  it('rejects a fractional Bag 25 kg count', () => {
    expect(() => validateShipmentSelection({ packageType: 'BAG_25KG', bags: '12.5' }))
      .toThrow('Bag 25 kg requires a whole-number bag count');
  });

  it('requires positive manual MT for Bulk Vessel and Truck shipments', () => {
    expect(() => validateShipmentSelection({ packageType: 'LEGACY', shipmentType: 'Bulk Vessel', mtPerShipment: '' }))
      .toThrow('Bulk Vessel requires a positive MT / Shipment value');
    expect(() => validateShipmentSelection({ packageType: 'LEGACY', shipmentType: 'Truck', mtPerShipment: '0' }))
      .toThrow('Truck requires a positive MT / Shipment value');
  });

  it('sends FX approval only through the manager RPC', async () => {
    let args;
    const supabase = { rpc: (name, value) => { args = { name, value }; return Promise.resolve({ data: 'po-1', error: null }); } };
    await approvePurchaseOrderFx(supabase, 'po-1', 0.92, 'WCAT Bank', '2026-08-11');
    expect(args).toEqual({ name: 'approve_po_fx', value: { p_po_id: 'po-1', p_fx_rate: 0.92, p_bank_name: 'WCAT Bank', p_rate_date: '2026-08-11' } });
  });
});
