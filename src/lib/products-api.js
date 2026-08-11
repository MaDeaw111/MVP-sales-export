export async function listProducts(supabase) { const { data, error } = await supabase.from('products').select('id,code,name,grade,is_active').order('code'); if (error) throw error; return data; }
export async function listProductSpecs(supabase) {
  const { data, error } = await supabase.from('products')
    .select('id,code,name,description,remark,is_active,product_specs(id,name,version,status,parameters,note)')
    .order('code');
  if (error) throw error;
  return data;
}
export async function updateProductMaster(supabase, productId, { name, shortName, remark }) {
  if (!productId || !name?.trim() || !shortName?.trim()) throw new Error('Product name and short name are required');
  const { error } = await supabase.from('products').update({ name: name.trim(), description: `Short name: ${shortName.trim()}`, remark: remark?.trim() || null }).eq('id', productId);
  if (error) throw error;
}
export async function createProduct(supabase, { code, name }) {
  if (!code?.trim() || !name?.trim()) throw new Error('Product code and name are required');
  const { data, error } = await supabase.from('products').insert({ code: code.trim(), name: name.trim(), is_active: true }).select('id,code,name,is_active').single();
  if (error) throw error; return data;
}
export async function createProductFromSpec(supabase, { code, name, shortName, parameters, note = null }) {
  if (!code?.trim() || !name?.trim() || !shortName?.trim()) throw new Error('Product code, name, and short name are required');
  const { data, error } = await supabase.rpc('create_product_with_approved_spec', {
    p_product: { code: code.trim(), name: name.trim(), short_name: shortName.trim() },
    p_spec: { name: name.trim(), version: '1.0', parameters, note }
  });
  if (error) throw error;
  return data;
}
export async function createProductSpec(supabase, { productId, name, version, parameters = {}, note = null }) {
  if (!productId || !name?.trim() || !version?.trim()) throw new Error('Product, spec name, and version are required');
  const { data, error } = await supabase.from('product_specs').insert({ product_id: productId, name: name.trim(), version: version.trim(), status: 'APPROVED', parameters, note }).select('id,name,version,status').single();
  if (error) throw error; return data;
}
