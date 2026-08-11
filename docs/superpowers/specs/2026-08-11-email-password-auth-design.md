# Email + Password Authentication

## Goal

Replace the Release 1 Google-only sign-in entry point with Supabase Email +
Password authentication. The existing approved-profile gate remains mandatory.

## Design

- The browser app presents email and password inputs with a Sign in button.
- `signInWithPassword(supabase, { email, password })` validates the inputs and
  calls Supabase Auth's password sign-in API.
- Once authenticated, the app still calls `complete_google_login()` for
  profile binding and active-profile authorization. Its name is retained in
  this release to avoid a database contract migration; the function validates
  the authenticated user's email, regardless of Auth provider.
- An unsuccessful password sign-in shows the returned safe Supabase message.
- The deployment guide changes from Google OAuth setup to manually creating
  password users in the Supabase Dashboard and provisioning matching active
  `user_profiles` records.

## Out of Scope

- Password reset and self-service registration.
- Removing the optional future Google OAuth capability.
- Changing profile roles, RLS, or business-data access rules.

## Tests

- Unit tests cover required credentials, the Supabase password sign-in call,
  and propagation of a returned authentication error.
- Existing approved-profile session tests remain the proof that authenticated
  but unapproved users are denied access.
