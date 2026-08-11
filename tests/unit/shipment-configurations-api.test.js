import { describe, expect, it } from 'vitest';
import { createShipmentConfiguration, listShipmentConfigurations } from '../../src/lib/shipment-configurations-api.js';

describe('shipment configurations API', () => {
  it('lists active configurations by container type', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: (field) => { expect(field).toBe('container_type'); return Promise.resolve({ data: [], error: null }); } }) }) }) };
    await expect(listShipmentConfigurations(supabase)).resolves.toEqual([]);
  });
  it('creates a container load configuration', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value=input; return { select: () => ({ single: () => Promise.resolve({ data: { id:'c1' }, error:null }) }) }; } }) };
    await createShipmentConfiguration(supabase, { containerType:'20GP', packageName:'Jumbo Bag 850 kg', standardMt:17 });
    expect(value).toMatchObject({ container_type:'20GP', package:'Jumbo Bag 850 kg', standard_mt_per_container:17, is_active:true });
  });
});
