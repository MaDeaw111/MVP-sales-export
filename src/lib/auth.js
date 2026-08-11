export async function signInWithGoogle(supabase) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut(supabase) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
