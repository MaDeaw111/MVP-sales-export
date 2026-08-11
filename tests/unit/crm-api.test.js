import { describe, expect, it } from 'vitest';
import { createCrmActivity, listCrmActivities } from '../../src/lib/crm-api.js';

describe('CRM API', () => {
  it('lists newest activities first for a customer', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: (field, options) => { expect(field).toBe('activity_date'); expect(options).toEqual({ ascending: false }); return Promise.resolve({ data: [], error: null }); } }) }) }) };
    await expect(listCrmActivities(supabase, 'customer-1')).resolves.toEqual([]);
  });

  it('creates a shared customer activity', async () => {
    let payload;
    const supabase = { from: () => ({ insert: (value) => { payload = value; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'a1' }, error: null }) }) }; } }) };
    await createCrmActivity(supabase, 'customer-1', { topic: 'Price / Negotiation', channel: 'Email', note: 'Customer requested an updated quote.' });
    expect(payload).toMatchObject({ customer_id: 'customer-1', topic: 'Price / Negotiation', channel: 'Email' });
  });
});
