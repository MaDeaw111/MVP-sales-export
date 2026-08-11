import { describe, expect, it } from 'vitest';
import { approveSpecialPriceRequest, createSpecialPriceRequest } from '../../src/lib/special-prices-api.js';

describe('special prices API', () => {
  it('calls the approval RPC with the manager decision', async () => {
    let args;
    const supabase = { rpc: (name, value) => { args = { name, value }; return Promise.resolve({ data: 'request-1', error: null }); } };
    await expect(approveSpecialPriceRequest(supabase, 'request-1', 410, '2026-09-30', 'Volume commitment')).resolves.toBe('request-1');
    expect(args).toEqual({ name: 'approve_special_price_request', value: { p_request_id: 'request-1', p_approved_fob_usd_mt: 410, p_valid_until: '2026-09-30', p_note: 'Volume commitment' } });
  });
  it('creates a pending pre-PO request', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value=input; return { select: () => ({ single: () => Promise.resolve({ data:{id:'request-1'},error:null }) }) }; } }) };
    await createSpecialPriceRequest(supabase,{customerId:'c1',productId:'p1',specId:'s1',requestedFob:405,reason:'New market'});
    expect(value).toMatchObject({customer_id:'c1',product_id:'p1',product_spec_id:'s1',requested_fob_usd_mt:405,status:'PENDING'});
  });
});
