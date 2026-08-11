export async function completeApprovedSession(supabase) {
  const { data, error } = await supabase.rpc('complete_google_login');
  if (error) throw new Error('Your account has not been approved');
  const profile = data?.[0];
  if (!profile) throw new Error('Your account has not been approved');
  return profile;
}
