# Customer PO Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select any readable Customer by code and name when creating a PO, then atomically promote that customer to `ACTIVE_CUSTOMER` after a successful PO insert.

**Architecture:** The PO view will reuse `listCustomers()` and the existing DOM-safe option builder, submitting the selected UUID through the existing `customerId` contract. A new additive PostgreSQL `AFTER INSERT` trigger updates the referenced customer status, keeping the database as the authority for the business transition.

**Tech Stack:** Vanilla ES modules, Supabase JavaScript client, PostgreSQL migrations/pgTAP, Vitest, Vite.

## Global Constraints

- Customer options include every record visible under existing Customer-directory RLS, including `PROSPECT`, `ACTIVE_CUSTOMER`, and `INACTIVE`.
- Option labels are `customer_code — name`; absent customer codes fall back to name only; option values are customer UUIDs.
- Customer labels use DOM APIs and `textContent`; no master data is interpolated into HTML.
- The PO create API continues to receive `customerId` and write it as `purchase_orders.customer_id`.
- Only a successful `INSERT` on `purchase_orders` promotes the referenced customer to `ACTIVE_CUSTOMER`; PO updates must not change customer status.
- Do not edit or stage `Data/`, `2026-08-11-wcat-sales-support-webapp-design.md`, or `WCAT_Sales_Support_WebApp_MVP_Requirements_v7.md`.

---

### Task 1: Load and Select Customer Directory Entries in New PO

**Files:**
- Modify: `src/views/purchase-orders.js`
- Modify: `tests/unit/purchase-orders-view.test.js`

**Interfaces:**
- Consumes: `listCustomers(supabase)` from `src/lib/customers-api.js`, returning `{ id, customer_code, name, status }[]` within the caller's RLS scope.
- Produces: a required `select[name="customerId"]` containing customer UUID values, ready for `createPurchaseOrder()`.

- [ ] **Step 1: Write failing PO-view tests**

  Extend the Supabase test fixture's `from('customers')` handler with records for `PROSPECT`, `ACTIVE_CUSTOMER`, and `INACTIVE`. Assert all three names appear, the Prospect option value is its UUID, and the old `input[name="customerId"]` is absent.

  ```js
  expect(document.querySelector('select[name="customerId"]')).not.toBeNull();
  expect([...document.querySelector('select[name="customerId"]').options])
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'customer-prospect', textContent: 'CUST-001 — Prospect Buyer' }),
      expect.objectContaining({ value: 'customer-active', textContent: 'CUST-002 — Active Buyer' }),
      expect.objectContaining({ value: 'customer-inactive', textContent: 'CUST-003 — Inactive Buyer' }),
    ]));
  expect(document.querySelector('input[name="customerId"]')).toBeNull();
  ```

- [ ] **Step 2: Run the focused view test and verify it fails**

  Run:

  ```powershell
  pnpm exec vitest run tests/unit/purchase-orders-view.test.js
  ```

  Expected: FAIL because the current form renders raw `Customer ID` input and does not request `customers`.

- [ ] **Step 3: Implement minimal customer option loading**

  Import `listCustomers`. During `renderPurchaseOrders()`, load customers independently from Product and Shipment data. Replace the raw Customer input with `<label>Customer<select name="customerId" required disabled></select></label>`. Populate it with `setSelectOptions()` after load:

  ```js
  setSelectOptions(form.elements.customerId, 'Select Customer', customers.map((customer) => ({
    value: customer.id,
    label: customer.customer_code ? `${customer.customer_code} — ${customer.name}` : customer.name,
  })));
  form.elements.customerId.disabled = customers.length === 0;
  ```

  On lookup failure, preserve a disabled select with placeholder `Customer directory unavailable`; do not expose a raw UUID alternative.

- [ ] **Step 4: Add failure and insert-contract assertions**

  Add a fixture where `customers` returns an error. Assert the select is disabled and uses the unavailable placeholder. In the standard fixture, choose `customer-prospect`, complete all existing required PO fields, submit, and assert the mocked insert payload has `customer_id: 'customer-prospect'`.

- [ ] **Step 5: Run focused tests and full unit suite**

  Run:

  ```powershell
  pnpm exec vitest run tests/unit/purchase-orders-view.test.js tests/unit/purchase-orders-api.test.js
  pnpm test:unit
  ```

  Expected: PASS.

- [ ] **Step 6: Commit the PO selector UI**

  ```powershell
  git add src/views/purchase-orders.js tests/unit/purchase-orders-view.test.js
  git commit -m "feat: select customers when creating PO"
  ```

### Task 2: Promote Customer Status After Successful PO Insert

**Files:**
- Create: `supabase/migrations/<timestamp>_activate_customer_on_po_insert.sql`
- Create: `supabase/tests/0015_customer_po_activation.test.sql`

**Interfaces:**
- Consumes: `public.purchase_orders.customer_id` and `public.customers.status`.
- Produces: trigger function `public.activate_customer_after_po_insert()` and trigger `activate_customer_after_po_insert` that run only after PO insert.

- [ ] **Step 1: Write failing pgTAP tests**

  Create a Prospect customer and all required PO fixture records. Insert a valid PO and assert the customer is `ACTIVE_CUSTOMER`. In a separate rollback-only case, attempt an invalid PO insert (for example non-positive quantity) and assert the customer remains `PROSPECT`. Update the valid PO's commercial data and assert its customer stays at the status already recorded, proving updates do not invoke the transition.

  ```sql
  select is(
    (select status::text from public.customers where id = (select customer_id from customer_po_activation_fixture)),
    'ACTIVE_CUSTOMER',
    'a successful PO insert activates its customer'
  );
  ```

- [ ] **Step 2: Run the focused database test and verify it fails**

  Run:

  ```powershell
  pnpm exec supabase test db --local supabase/tests/0015_customer_po_activation.test.sql
  ```

  Expected: FAIL because no activation trigger exists.

- [ ] **Step 3: Create additive migration and trigger**

  Create the migration with `pnpm exec supabase migration new activate_customer_on_po_insert`. Implement the trigger function with a hardened `search_path`, then attach it only to `AFTER INSERT`:

  ```sql
  create or replace function public.activate_customer_after_po_insert()
  returns trigger
  language plpgsql
  set search_path = public
  as $$
  begin
    update public.customers
    set status = 'ACTIVE_CUSTOMER'
    where id = new.customer_id
      and status is distinct from 'ACTIVE_CUSTOMER'::public.customer_status;
    return new;
  end;
  $$;

  drop trigger if exists activate_customer_after_po_insert on public.purchase_orders;
  create trigger activate_customer_after_po_insert
  after insert on public.purchase_orders
  for each row execute function public.activate_customer_after_po_insert();
  ```

- [ ] **Step 4: Reset local database and run pgTAP suite**

  Run:

  ```powershell
  pnpm exec supabase db reset --local
  pnpm exec supabase test db --local supabase/tests
  ```

  Expected: all existing tests plus the activation test pass.

- [ ] **Step 5: Commit the database transition**

  ```powershell
  git add supabase/migrations supabase/tests/0015_customer_po_activation.test.sql
  git commit -m "feat: activate customers when POs are created"
  ```

### Task 3: Verify Production Readiness and Deploy the Additive Migration

**Files:**
- Modify: `README.md` only if it currently documents raw Customer ID entry for PO creation.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: one verified deployment-ready branch and exactly one applied production migration.

- [ ] **Step 1: Run complete verification**

  Run:

  ```powershell
  pnpm test:unit
  pnpm exec vite build
  pnpm exec supabase test db --local supabase/tests
  ```

  Expected: all tests and build pass.

- [ ] **Step 2: Inspect the documentation scope**

  If `README.md` says users enter raw Customer IDs while creating PO, replace only that sentence with `Select Customer (code — name)`. Otherwise leave README unchanged.

- [ ] **Step 3: Apply reviewed migration to production**

  Apply only Task 2's generated SQL to Supabase project `qopretpbnebzyhwlanps` through the Supabase apply-migration tool. Then query the trigger catalog to verify `activate_customer_after_po_insert` is an `AFTER INSERT` trigger on `public.purchase_orders`.

- [ ] **Step 4: Commit documentation only if changed**

  ```powershell
  git add README.md
  git commit -m "docs: explain customer selection for POs"
  ```

  Skip this step when no README change was required.

## Review Checklist

- The visible PO Customer field is a select sourced from the Customer directory and contains no raw-ID text field.
- All readable customer statuses are available for selection.
- Names and codes cannot create markup in the form.
- A successful PO insert activates the selected customer; failed inserts and PO updates do not cause an unintended status transition.
- The production migration is additive and does not alter prior migration files.
