async function single(query) { const { data, error } = await query; if (error) throw error; return data; }
export async function listContacts(supabase, customerId) { const { data, error } = await supabase.from('customer_contacts').select('id,name,position,email,phone').eq('customer_id', customerId).order('name'); if (error) throw error; return data; }
export async function createContact(supabase, customerId, values) {
  if (!values.name?.trim()) throw new Error('Contact name is required');
  return single(supabase.from('customer_contacts').insert({ customer_id: customerId, name: values.name.trim(), email: values.email?.trim() || null, phone: values.phone?.trim() || null }).select('id,name,email,phone').single());
}
export async function createAction(supabase, activityId, { action, dueDate }) {
  if (!action?.trim()) throw new Error('Action is required');
  return single(supabase.from('action_required').insert({ activity_id: activityId, action: action.trim(), due_date: dueDate || null }).select('id').single());
}
