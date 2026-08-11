# Email + Password Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let WCAT users sign in with Supabase Email + Password while retaining the active approved-profile gate.

**Architecture:** Add a small, dependency-injected password-auth helper to the browser auth module. Replace the Google-only sign-in card with a native HTML form that invokes the helper and leaves the existing `completeApprovedSession()` flow unchanged after authentication.

**Tech Stack:** Vanilla JavaScript ES modules, Vite, `@supabase/supabase-js`, Vitest.

## Global Constraints

- Do not expose a Supabase secret or service-role key in the browser.
- No self-service registration or password reset in Release 1.
- Authentication alone never grants business access; `complete_google_login()` must continue to require an active `user_profiles` record.
- User-facing authentication errors must be safe Supabase Auth errors, not raw exceptions.

---

### Task 1: Password authentication helper

**Files:**
- Modify: `src/lib/auth.js`
- Modify: `tests/unit/auth.test.js`

**Interfaces:**
- Consumes: a Supabase-like object exposing `auth.signInWithPassword({ email, password })`.
- Produces: `signInWithPassword(supabase, { email, password }): Promise<void>`.

- [x] **Step 1: Write failing tests**

```js
import { describe, expect, it } from 'vitest';
import { signInWithPassword } from '../../src/lib/auth.js';

it('requires an email address', async () => {
  await expect(signInWithPassword({ auth: {} }, { email: '', password: 'secret' }))
    .rejects.toThrow('Email is required');
});

it('sends credentials to Supabase Auth', async () => {
  const signInWithPassword = async (credentials) => {
    expect(credentials).toEqual({ email: 'sales@wcat.example', password: 'secret' });
    return { error: null };
  };
  await expect(signInWithPassword({ auth: { signInWithPassword } }, {
    email: 'sales@wcat.example', password: 'secret',
  })).resolves.toBeUndefined();
});
```

- [x] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/auth.test.js`

Expected: FAIL because `signInWithPassword` is not exported.

- [x] **Step 3: Implement the minimal helper**

```js
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
```

- [x] **Step 4: Run the targeted test to verify it passes**

Run: `pnpm run test:unit -- tests/unit/auth.test.js`

Expected: PASS.

- [x] **Step 5: Commit the helper and test**

```powershell
git add src/lib/auth.js tests/unit/auth.test.js
git commit -m "feat: add email password sign-in helper"
```

### Task 2: Sign-in screen and administrator guide

**Files:**
- Modify: `src/main.js`
- Modify: `README.md`
- Modify: `docs/deployment.md`

**Interfaces:**
- Consumes: `signInWithPassword(supabase, { email, password })` from `src/lib/auth.js`.
- Produces: a login form that submits credentials and continues through `completeApprovedSession()` once Supabase emits an authenticated session.

- [x] **Step 1: Write the failing screen test**

Add a DOM test asserting the unauthenticated view has inputs named `email` and `password` and submits `{ email, password }` to the password-auth helper. Use the project’s jsdom/Vitest setup or extract `renderSignIn()` into `src/views/sign-in.js` if direct testing of `main.js` is impractical.

- [x] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/sign-in-screen.test.js`

Expected: FAIL because the page contains only `#google-sign-in`.

- [x] **Step 3: Implement the form and documentation**

Replace the Google button with a form containing `type="email"`, `autocomplete="email"`, `type="password"`, and `autocomplete="current-password"`. Prevent default submit, invoke `signInWithPassword`, and route errors through the existing `renderError` function.

Update `README.md` and `docs/deployment.md` to say that an Admin creates an Auth user through **Authentication → Users → Add user**, chooses a strong password, confirms the user as required by the Dashboard, then creates a matching lowercase active profile with the SQL bootstrap procedure. Remove the Google OAuth setup prerequisite.

- [x] **Step 4: Run focused and full verification**

Run:

```powershell
pnpm run test:unit
pnpm run build
```

Expected: all unit tests pass and Vite produces `dist/`.

- [x] **Step 5: Commit the application and guide updates**

```powershell
git add src/main.js README.md docs/deployment.md tests/unit/auth.test.js
git commit -m "feat: use email password authentication"
```

## Self-review

- Approved profile gate: preserved by leaving `completeApprovedSession()` unchanged.
- Password helper, login screen, error handling, tests, and operator onboarding: covered by Tasks 1–2.
- No secret-key, reset, or registration scope added.
