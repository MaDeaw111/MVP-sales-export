import { describe, expect, it } from 'vitest';
import { createProduct, createProductSpec, listProducts } from '../../src/lib/products-api.js';

describe('products API', () => {
  it('lists active products by code', async () => {
    const supabase = { from: () => ({ select: () => ({ order: (field) => { expect(field).toBe('code'); return Promise.resolve({ data: [], error: null }); } }) }) };
    await expect(listProducts(supabase)).resolves.toEqual([]);
  });
  it('creates an active product', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value = input; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'p1' }, error: null }) }) }; } }) };
    await createProduct(supabase, { code: 'TAP-65', name: 'Tapioca Pellet' });
    expect(value).toEqual({ code: 'TAP-65', name: 'Tapioca Pellet', is_active: true });
  });
  it('creates an approved product specification', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value = input; return { select: () => ({ single: () => Promise.resolve({ data: { id: 's1' }, error: null }) }) }; } }) };
    await createProductSpec(supabase, { productId: 'p1', name: 'Starch Min 65%', version: 'v1' });
    expect(value).toMatchObject({ product_id: 'p1', name: 'Starch Min 65%', version: 'v1', status: 'APPROVED' });
  });
});
