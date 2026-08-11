export async function listCustomers(supabase) {
  const { data, error } = await supabase.from('customers').select('id,customer_code,name,source,status,created_at').order('name');
  if (error) throw error;
  return data;
}

export async function createDirectCustomer(supabase, name) {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Customer name is required');
  const { data, error } = await supabase
    .from('customers')
    .insert({ name: trimmedName, source: 'DIRECT_WCAT', status: 'PROSPECT' })
    .select('id,name,source,status')
    .single();
  if (error) throw error;
  return data;
}
