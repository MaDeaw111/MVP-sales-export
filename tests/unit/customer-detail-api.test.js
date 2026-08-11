import { describe, expect, it } from 'vitest';
import { createContact, createAction } from '../../src/lib/customer-detail-api.js';

describe('customer detail API', () => {
  it('creates a contact for a customer', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value = input; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'contact-1' }, error: null }) }) }; } }) };
    await createContact(supabase, 'customer-1', { name: 'Ava Buyer', email: 'ava@example.com' });
    expect(value).toMatchObject({ customer_id: 'customer-1', name: 'Ava Buyer', email: 'ava@example.com' });
  });

  it('creates an action linked to an activity', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value = input; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'action-1' }, error: null }) }) }; } }) };
    await createAction(supabase, 'activity-1', { action: 'Send revised quote', dueDate: '2026-08-15' });
    expect(value).toEqual({ activity_id: 'activity-1', action: 'Send revised quote', due_date: '2026-08-15' });
  });
});
