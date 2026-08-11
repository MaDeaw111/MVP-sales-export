import { describe, expect, it } from 'vitest';
import { listCustomers, createDirectCustomer } from '../../src/lib/customers-api.js';

describe('customers API', () => {
  it('loads customers ordered by name', async () => {
    const calls = [];
    const supabase = { from: () => ({ select: () => ({ order: (field) => { calls.push(field); return Promise.resolve({ data: [{ name: 'ACME' }], error: null }); } }) }) };
    await expect(listCustomers(supabase)).resolves.toEqual([{ name: 'ACME' }]);
    expect(calls).toEqual(['name']);
  });

  it('creates a Direct WCAT prospect', async () => {
    let payload;
    const supabase = { from: () => ({ insert: (value) => { payload = value; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }) }; } }) };
    await expect(createDirectCustomer(supabase, 'New Buyer')).resolves.toEqual({ id: 'c1' });
    expect(payload).toEqual({ name: 'New Buyer', source: 'DIRECT_WCAT', status: 'PROSPECT' });
  });
});
