import { describe, expect, it } from 'vitest';
import { createShipmentConfiguration, listShipmentConfigurations } from '../../src/lib/shipment-configurations-api.js';

describe('shipment configurations API', () => {
  it('lists active configurations by container type', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: (field) => { expect(field).toBe('container_type'); return Promise.resolve({ data: [], error: null }); } }) }) }) };
    await expect(listShipmentConfigurations(supabase)).resolves.toEqual([]);
  });
  it('creates a Bag 25 kg configuration template', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value=input; return { select: () => ({ single: () => Promise.resolve({ data: { id:'c1' }, error:null }) }) }; } }) };
    await createShipmentConfiguration(supabase, { containerType:'20', packageType:'BAG_25KG' });
    expect(value).toMatchObject({ container_type:'20', package:'Bag 25 kg', package_type:'BAG_25KG', is_active:true });
  });
  it('sends a fixed Jumbobag selection without client-computed MT', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value = input; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }) }; } }) };
    await createShipmentConfiguration(supabase, { containerType: '40', packageType: 'JUMBOBAG', jumbobagId: 'j850', bagsPerContainer: '28' });
    expect(value).toMatchObject({ shipment_mode: 'Container', container_type: '40', package_type: 'JUMBOBAG', jumbobag_id: 'j850', bags_per_container: 28, is_active: true });
    expect(value.standard_mt_per_container).toBeUndefined();
  });
  it('sends direct MT and no bags for Bulk Container', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value = input; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }) }; } }) };
    await createShipmentConfiguration(supabase, { containerType: '20', packageType: 'BULK_CONTAINER', standardMt: '20', tolerancePercent: '5' });
    expect(value).toMatchObject({ package_type: 'BULK_CONTAINER', bags_per_container: null, standard_mt_per_container: 20, tolerance_percent: 5 });
  });
});
