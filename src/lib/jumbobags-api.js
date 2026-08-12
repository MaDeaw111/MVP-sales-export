export async function listJumbobags(supabase, includeInactive = false) {
  let query = supabase.from('jumbobag_master').select('id,weight_kg,is_active,remark,created_at').order('weight_kg');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createJumbobag(supabase, { weightKg, remark = null }) {
  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('Jumbobag weight must be positive');
  const { data, error } = await supabase.from('jumbobag_master').insert({ weight_kg: weight, remark: remark?.trim() || null, is_active: true }).select('id,weight_kg,is_active,remark').single();
  if (error) throw error;
  return data;
}

export async function updateJumbobag(supabase, id, { remark, isActive }) {
  const { error } = await supabase.from('jumbobag_master').update({ remark: remark?.trim() || null, is_active: Boolean(isActive) }).eq('id', id);
  if (error) throw error;
}
