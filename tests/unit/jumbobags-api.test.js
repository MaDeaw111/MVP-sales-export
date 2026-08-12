import { expect, it } from 'vitest';
import { createJumbobag, updateJumbobag } from '../../src/lib/jumbobags-api.js';

it('creates an active Jumbobag weight', async () => {
  let inserted;
  const supabase = { from: () => ({ insert: (payload) => { inserted = payload; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'j1' }, error: null }) }) }; } }) };
  await createJumbobag(supabase, { weightKg: '1000', remark: 'New supplier bag' });
  expect(inserted).toEqual({ weight_kg: 1000, remark: 'New supplier bag', is_active: true });
});

it('updates only the remark and active state of a Jumbobag', async () => {
  let updated;
  const supabase = { from: () => ({ update: (payload) => { updated = payload; return { eq: () => Promise.resolve({ error: null }) }; } }) };
  await updateJumbobag(supabase, 'j1', { remark: 'Supplier retired this bag', isActive: false });
  expect(updated).toEqual({ remark: 'Supplier retired this bag', is_active: false });
});
