export async function listCrmActivities(supabase, customerId) {
  const { data, error } = await supabase.from('crm_activities').select('id,activity_date,topic,channel,note').eq('customer_id', customerId).order('activity_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCrmActivity(supabase, customerId, { topic, channel, note }) {
  if (!topic || !channel || !note?.trim()) throw new Error('Topic, channel, and note are required');
  const { data, error } = await supabase.from('crm_activities').insert({ customer_id: customerId, topic, channel, note: note.trim() }).select('id').single();
  if (error) throw error;
  return data;
}
