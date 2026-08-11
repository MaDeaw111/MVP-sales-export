# Admin Customer Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admins edit customer details without breaking Direct WCAT or External Sales ownership rules.

**Architecture:** A migration separates customer read/create/update RLS policy and validates source/owner/status in a trigger. The existing Customer Detail page gains an Admin-only editor backed by focused API helpers.

**Tech Stack:** Supabase Postgres/RLS, Vanilla JavaScript, Vitest, pgTAP.

## Global Constraints

- Only Admin may update customers at the database boundary.
- `EXTERNAL_SALES` requires an active External Sales owner and `ACTIVE_CUSTOMER` status.
- `DIRECT_WCAT` clears its owner.

---

### Task 1: Customer update authorization

**Files:**
- Create: `supabase/migrations/<timestamp>_admin_customer_edits.sql`
- Create: `supabase/tests/0012_admin_customer_edit.test.sql`

**Interfaces:**
- Produces: `validate_customer_source_owner()` trigger function and `admins update customers` RLS policy.

- [x] **Step 1: Write failing database tests**

```sql
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'admins update customers'), 'admins have a customer update policy');
select ok(exists (select 1 from pg_trigger where tgname = 'validate_customer_source_owner'), 'customer validation trigger exists');
```

- [x] **Step 2: Verify the tests fail**

Run: `supabase db reset`, then `supabase test db`.

- [x] **Step 3: Implement the migration**

Drop the current all-purpose customer policy. Add dedicated read, internal Direct-WCAT create, and Admin-only update policies. Add a `BEFORE INSERT OR UPDATE` trigger that clears Direct WCAT owners and rejects invalid External Sales owner/status combinations.

- [x] **Step 4: Verify database behavior**

Run: `supabase db reset`, then `supabase test db`.

- [x] **Step 5: Commit**

Run: `git add supabase/migrations supabase/tests` then `git commit -m "feat: enforce admin customer editing"`.

### Task 2: Detail editor

**Files:**
- Modify: `src/lib/customers-api.js`
- Modify: `src/views/customer-detail.js`
- Modify: `tests/unit/customers-api.test.js`

**Interfaces:**
- Produces: `updateCustomer(supabase, customerId, values)` and `listExternalSalesProfiles(supabase)`.

- [x] **Step 1: Write failing unit tests**

```js
await expect(updateCustomer(supabase, 'c1', {
  customerCode: 'CUST-001', name: 'Buyer', source: 'EXTERNAL_SALES',
  ownerProfileId: '', status: 'ACTIVE_CUSTOMER',
})).rejects.toThrow('External Sales owner is required');
```

Add a Direct WCAT test that verifies `owner_profile_id: null` reaches the API.

- [x] **Step 2: Verify the test fails**

Run: `pnpm run test:unit -- tests/unit/customers-api.test.js`.

- [x] **Step 3: Implement the API and form**

Render an Admin-only edit form on Customer Detail. Source toggles the owner field, Direct WCAT clears the owner, and External Sales submits `ACTIVE_CUSTOMER`. Refresh the detail header after save.

- [x] **Step 4: Verify the app**

Run: `pnpm run test:unit` and `pnpm run build`.

- [ ] **Step 5: Commit**

Run: `git add src tests/unit` then `git commit -m "feat: add admin customer detail editor"`.

## Self-review

- RLS and UI both enforce Admin editing.
- Source/owner/status constraints are validated at the database boundary.
- Existing non-Admin customer access remains read-only.
