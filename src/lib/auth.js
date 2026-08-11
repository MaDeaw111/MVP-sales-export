export async function signInWithGoogle(supabase) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signInWithPassword(supabase, { email, password }) {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) throw new Error('Email is required');
  if (!password) throw new Error('Password is required');

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) throw error;
}

export async function signOut(supabase) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
