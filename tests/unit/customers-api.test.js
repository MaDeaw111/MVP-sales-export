import { describe, expect, it } from 'vitest';
import { listCustomers, createDirectCustomer, updateCustomer } from '../../src/lib/customers-api.js';

describe('customers API', () => {
  it('loads customers ordered by name', async () => {
    const calls = [];
    const supabase = { from: () => ({ select: (fields) => ({ order: (field) => { calls.push({ fields, field }); return Promise.resolve({ data: [{ customer_code: 'CUST-001', name: 'ACME' }], error: null }); } }) }) };
    await expect(listCustomers(supabase)).resolves.toEqual([{ customer_code: 'CUST-001', name: 'ACME' }]);
    expect(calls).toEqual([{ fields: 'id,customer_code,name,source,status,owner_profile_id,created_at', field: 'name' }]);
  });

  it('creates a Direct WCAT prospect', async () => {
    let payload;
    const supabase = { from: () => ({ insert: (value) => { payload = value; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }) }; } }) };
    await expect(createDirectCustomer(supabase, 'New Buyer')).resolves.toEqual({ id: 'c1' });
    expect(payload).toEqual({ name: 'New Buyer', source: 'DIRECT_WCAT', status: 'PROSPECT' });
  });

  it('rejects an External Sales update without an owner', async () => {
    await expect(updateCustomer({ from: () => ({}) }, 'c1', {
      customerCode: 'CUST-001',
      name: 'Buyer',
      source: 'EXTERNAL_SALES',
      ownerProfileId: '',
      status: 'ACTIVE_CUSTOMER',
    })).rejects.toThrow('External Sales owner is required');
  });

  it('clears the owner when updating a Direct WCAT customer', async () => {
    let payload;
    let updatedId;
    const supabase = {
      from: () => ({
        update: (value) => {
          payload = value;
          return {
            eq: (field, value) => {
              updatedId = { field, value };
              return { select: () => ({ single: () => Promise.resolve({ data: { id: 'c1', ...payload }, error: null }) }) };
            },
          };
        },
      }),
    };

    await expect(updateCustomer(supabase, 'c1', {
      customerCode: 'CUST-001',
      name: 'Buyer',
      source: 'DIRECT_WCAT',
      ownerProfileId: 'owner-1',
      status: 'PROSPECT',
    })).resolves.toMatchObject({ id: 'c1', owner_profile_id: null });

    expect(updatedId).toEqual({ field: 'id', value: 'c1' });
    expect(payload).toEqual({
      customer_code: 'CUST-001',
      name: 'Buyer',
      source: 'DIRECT_WCAT',
      status: 'PROSPECT',
      owner_profile_id: null,
    });
  });
});
