export async function listProducts(supabase) { const { data, error } = await supabase.from('products').select('id,code,name,grade,is_active').order('code'); if (error) throw error; return data; }
export async function createProduct(supabase, { code, name }) {
  if (!code?.trim() || !name?.trim()) throw new Error('Product code and name are required');
  const { data, error } = await supabase.from('products').insert({ code: code.trim(), name: name.trim(), is_active: true }).select('id,code,name,is_active').single();
  if (error) throw error; return data;
}
