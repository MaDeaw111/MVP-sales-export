import { describe, expect, it } from 'vitest';
import { createProduct, createProductFromSpec, createProductSpec, listProducts, listProductSpecs, updateProductMaster } from '../../src/lib/products-api.js';

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
  it('creates a product and approved specification atomically', async () => {
    let procedure; let input;
    const supabase = { rpc: (name, value) => { procedure = name; input = value; return Promise.resolve({ data: 'p2', error: null }); } };
    await expect(createProductFromSpec(supabase, { code: 'TAP-65', name: 'Tapioca Pellet', shortName: 'TP', parameters: { starch_min: 0.65 }, note: 'Derived from PROD-001' })).resolves.toBe('p2');
    expect(procedure).toBe('create_product_with_approved_spec');
    expect(input).toEqual({ p_product: { code: 'TAP-65', name: 'Tapioca Pellet', short_name: 'TP' }, p_spec: { name: 'Tapioca Pellet', version: '1.0', parameters: { starch_min: 0.65 }, note: 'Derived from PROD-001' } });
  });
  it('keeps technical limits when creating an approved product specification', async () => {
    let value;
    const supabase = { from: () => ({ insert: (input) => { value = input; return { select: () => ({ single: () => Promise.resolve({ data: { id: 's1' }, error: null }) }) }; } }) };
    await createProductSpec(supabase, { productId: 'p1', name: 'Tapioca pellet', version: '1.0', parameters: { starch_min: 0.65 }, note: 'Copied from PROD-005' });
    expect(value).toMatchObject({ parameters: { starch_min: 0.65 }, note: 'Copied from PROD-005' });
  });
  it('lists products with their technical specifications', async () => {
    let selected;
    const supabase = { from: () => ({ select: (value) => { selected = value; return { order: () => Promise.resolve({ data: [], error: null }) }; } }) };
    await expect(listProductSpecs(supabase)).resolves.toEqual([]);
    expect(selected).toContain('product_specs(id,name,version,status,parameters,note)');
  });
  it('updates only non-technical product master fields', async () => {
    let payload;
    const supabase = { from: () => ({ update: (value) => { payload = value; return { eq: () => Promise.resolve({ error: null }) }; } }) };
    await updateProductMaster(supabase, 'product-1', { name: 'Updated pellet', shortName: 'UP', remark: 'Commercial name updated' });
    expect(payload).toEqual({ name: 'Updated pellet', description: 'Short name: UP', remark: 'Commercial name updated' });
  });
});
