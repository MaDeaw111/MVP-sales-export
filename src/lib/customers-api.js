export async function listCustomers(supabase) {
  const { data, error } = await supabase.from('customers').select('id,customer_code,name,source,status,owner_profile_id,created_at').order('name');
  if (error) throw error;
  return data;
}

export async function listExternalSalesProfiles(supabase) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id,email')
    .eq('role', 'EXTERNAL_SALES')
    .eq('is_active', true)
    .order('email');
  if (error) throw error;
  return data;
}

export async function updateCustomer(supabase, customerId, values) {
  const customerCode = values.customerCode?.trim();
  const name = values.name?.trim();
  if (!customerCode) throw new Error('Customer code is required');
  if (!name) throw new Error('Customer name is required');

  const isExternalSales = values.source === 'EXTERNAL_SALES';
  const ownerProfileId = isExternalSales ? values.ownerProfileId : null;
  if (isExternalSales && !ownerProfileId) throw new Error('External Sales owner is required');

  const { data, error } = await supabase
    .from('customers')
    .update({
      customer_code: customerCode,
      name,
      source: values.source,
      status: isExternalSales ? 'ACTIVE_CUSTOMER' : values.status,
      owner_profile_id: ownerProfileId || null,
    })
    .eq('id', customerId)
    .select('id,customer_code,name,source,status,owner_profile_id')
    .single();
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
