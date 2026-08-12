# Shipment Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standard Jumbobag/container load master data and snapshot the selected loading format on each Purchase Order.

**Architecture:** A Jumbobag Master owns valid weights. Each Shipment Configuration is one container/package/bag-count selection. Postgres calculates fixed Jumbobag payloads and validates all package rules. PO rows snapshot payload and tolerance so later master changes never rewrite history.

**Tech Stack:** Supabase Postgres/RLS, Vanilla ES modules, `@supabase/supabase-js`, Vitest, pgTAP, Vite.

## Global Constraints

- Seed only 850 kg, 950 kg, and 1,200 kg as active Jumbobag weights.
- Only Admin writes Jumbobag and Shipment Configuration master data.
- Jumbobag bag counts are fixed selectable configurations, never free text on a PO.
- Bag 25 kg accepts a positive whole-number bag count on a PO and calculates bags x 25 / 1,000.
- Bulk Container hides bags and uses direct MT / Container plus tolerance.
- Do not delete existing configurations or alter historic PO snapshots.
- Never expose a service-role key in browser code.

---

### Task 1: Normalize database schema and seed master data

**Files:**
- Create: `supabase/migrations/20260811170000_normalize_shipment_configurations.sql`
- Create: `supabase/tests/0013_shipment_configuration_master.test.sql`

**Interfaces:**
- Produces `jumbobag_master(id, weight_kg, is_active, remark)`.
- Produces `shipment_configurations.package_type`, `jumbobag_id`, and `sync_shipment_configuration()`.
- Produces PO snapshot fields `shipment_bags_per_container`, `shipment_mt_per_container`, and `shipment_tolerance_percent`.

- [ ] **Step 1: Write a failing pgTAP test**

```sql
select plan(4);
select ok(to_regclass('public.jumbobag_master') is not null, 'Jumbobag master exists');
select is((select count(*)::int from public.jumbobag_master where is_active), 3, 'three active weights seeded');
select throws_ok($$insert into public.shipment_configurations(shipment_mode,container_type,package,package_type,bags_per_container,standard_mt_per_container,is_active) values ('Container','40','Jumbobag','JUMBOBAG',28,0,true)$$, '%Jumbobag%', 'Jumbobag config requires a master weight');
select * from finish();
```

- [ ] **Step 2: Run the test and verify RED**

Run: `supabase test db --local supabase/tests/0013_shipment_configuration_master.test.sql`

Expected: FAIL because the master table and trigger do not exist.

- [ ] **Step 3: Implement the migration**

Create `jumbobag_master` with `weight_kg numeric(10,3) unique check(weight_kg > 0)`, `is_active`, `remark`, and timestamps. Enable RLS: active profiles read; `has_app_role('ADMIN')` writes. Seed 850, 950, and 1200 with `on conflict do nothing`.

Add `package_type text not null default 'LEGACY' check(package_type in ('JUMBOBAG','BAG_25KG','BULK_CONTAINER','LEGACY'))`, plus `jumbobag_id uuid references public.jumbobag_master(id)`. Add the three PO snapshot columns.

Create a `before insert or update` trigger with these exact rules:

```sql
-- JUMBOBAG: active jumbobag_id and positive bags are required; set MT = weight * bags / 1000.
-- BAG_25KG: jumbobag_id, fixed bags, and config MT are null; set bag_weight_kg = 25.
-- BULK_CONTAINER: jumbobag_id and bags are null; direct positive MT is required.
-- LEGACY: preserve existing Bulk Vessel and Truck rows.
```

Backfill known Jumbobag labels. Retain Bulk Vessel/Truck as `LEGACY`; deactivate non-conforming old 40'/40HQ default records. Seed idempotently: 20' 850/950/1200 kg x 20 bags; 40'/40HQ 850 kg x 27/28/29/30 bags; 20' Bulk Container 20 MT with 5% tolerance. Replace config write policy with Admin-only; retain active-profile read; grant the new table to `authenticated`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `supabase db reset; supabase test db --local supabase/tests/0013_shipment_configuration_master.test.sql`

Expected: PASS; invalid Jumbobag input fails and valid configuration MT is calculated.

- [ ] **Step 5: Commit**

Run: `git add supabase/migrations/20260811170000_normalize_shipment_configurations.sql supabase/tests/0013_shipment_configuration_master.test.sql; git commit -m "feat: normalize shipment configuration master data"`

### Task 2: Add calculation helpers and Jumbobag Master page

**Files:**
- Create: `src/lib/shipment-load-calculations.js`
- Create: `src/lib/jumbobags-api.js`
- Create: `src/views/jumbobags.js`
- Modify: `src/main.js`
- Modify: `src/styles/app.css`
- Create: `tests/unit/shipment-load-calculations.test.js`
- Create: `tests/unit/jumbobags-api.test.js`
- Create: `tests/unit/jumbobags-view.test.js`

**Interfaces:**
- Produces `calculateBaggedMt(weightKg, bags)` and `configurationFieldMode(packageType)`.
- Produces `listJumbobags`, `createJumbobag`, `updateJumbobag`, and Admin-only `#jumbobags` route.

- [ ] **Step 1: Write failing unit tests**

```js
it('calculates a 28 x 850 kg load', () => expect(calculateBaggedMt(850, 28)).toBe(23.8));
it('hides bags for Bulk', () => expect(configurationFieldMode('BULK_CONTAINER')).toEqual({ showJumbobag: false, showBags: false, bagsEditable: false, mtEditable: true }));
it('creates an active Jumbobag master row', async () => {
  await createJumbobag(supabase, { weightKg: '1000', remark: 'New supplier bag' });
  expect(inserted).toEqual({ weight_kg: 1000, remark: 'New supplier bag', is_active: true });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd run test:unit -- shipment-load-calculations.test.js jumbobags-api.test.js jumbobags-view.test.js`

Expected: FAIL because these modules do not exist.

- [ ] **Step 3: Implement helpers and page**

Reject non-positive/non-integer bags, calculate `weightKg * bags / 1000`, and round to three decimals. Return exact field modes: Jumbobag shows fixed Bags/readonly MT; Bag 25 kg shows editable Bags/readonly MT; Bulk hides Bags/editable MT.

Use direct Supabase CRUD for Jumbobag Master. Validate positive numeric weight. The view shows active/inactive rows and create/edit/deactivate controls only to Admin. All approved users can view; only Admin sees its navigation item.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd run test:unit -- shipment-load-calculations.test.js jumbobags-api.test.js jumbobags-view.test.js; npm.cmd run build`

Expected: PASS and Vite emits `dist`.

- [ ] **Step 5: Commit**

Run: `git add src/lib/shipment-load-calculations.js src/lib/jumbobags-api.js src/views/jumbobags.js src/main.js src/styles/app.css tests/unit/shipment-load-calculations.test.js tests/unit/jumbobags-api.test.js tests/unit/jumbobags-view.test.js; git commit -m "feat: manage Jumbobag master data"`

### Task 3: Replace Shipment Configuration editor with dependent controls

**Files:**
- Modify: `src/lib/shipment-configurations-api.js`
- Modify: `src/views/shipment-configurations.js`
- Modify: `tests/unit/shipment-configurations-api.test.js`
- Create: `tests/unit/shipment-configurations-view.test.js`

**Interfaces:**
- `listShipmentConfigurations(supabase, options)` returns package type, Jumbobag, bags, MT, tolerance, and active state.
- `createShipmentConfiguration(supabase, values)` sends only server-validated fields.

- [ ] **Step 1: Write failing tests**

```js
it('sends fixed Jumbobag selection without client MT', async () => {
  await createShipmentConfiguration(supabase, { containerType: '40', packageType: 'JUMBOBAG', jumbobagId: 'j850', bagsPerContainer: '28' });
  expect(inserted).toMatchObject({ container_type: '40', package_type: 'JUMBOBAG', jumbobag_id: 'j850', bags_per_container: 28 });
  expect(inserted.standard_mt_per_container).toBeUndefined();
});
it('hides Bags and shows direct MT for Bulk', async () => {
  await renderShipmentConfigurations(container, { supabase, profile: { role: 'ADMIN' } });
  selectPackage('BULK_CONTAINER');
  expect(container.querySelector('[name="bagsPerContainer"]')).toBeNull();
  expect(container.querySelector('[name="standardMt"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd run test:unit -- shipment-configurations-api.test.js shipment-configurations-view.test.js`

Expected: FAIL because the current editor accepts unrestricted free text.

- [ ] **Step 3: Implement the dependent editor**

Use selects for 20', 40', 40HQ and package type. Fetch active Jumbobag weights. Jumbobag creates fixed bag-count rows and previews read-only calculated MT; Bag 25 kg creates a template with no fixed Bags/MT; Bulk hides Bags and requires direct MT/tolerance. Render legacy Bulk Vessel/Truck separately and read-only. Create/edit/deactivate controls render only for Admin.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd run test:unit -- shipment-configurations-api.test.js shipment-configurations-view.test.js jumbobags-api.test.js jumbobags-view.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/lib/shipment-configurations-api.js src/views/shipment-configurations.js tests/unit/shipment-configurations-api.test.js tests/unit/shipment-configurations-view.test.js; git commit -m "feat: add package-aware shipment configurations"`

### Task 4: Snapshot shipment load on Purchase Orders and release

**Files:**
- Modify: `src/lib/purchase-orders-api.js`
- Modify: `src/views/purchase-orders.js`
- Modify: `tests/unit/purchase-orders-api.test.js`
- Create: `tests/unit/purchase-order-shipment.test.js`
- Modify: `supabase/tests/0013_shipment_configuration_master.test.sql`
- Modify: `README.md`
- Modify: `docs/deployment.md`

**Interfaces:**
- `createPurchaseOrder(supabase, values)` accepts `shipmentConfigurationId` and optional `shipmentBagsPerContainer`.
- PO trigger rejects inactive configs, copies fixed/Bulk MT+tolerance, and calculates Bag 25 kg MT.

- [ ] **Step 1: Write failing tests**

```js
it('includes selected configuration in PO payload', async () => {
  await createPurchaseOrder(supabase, basePo({ shipmentConfigurationId: 'cfg-28' }));
  expect(inserted.shipment_configuration_id).toBe('cfg-28');
});
it('rejects fractional Bag 25 kg count', () => {
  expect(() => validateShipmentSelection({ packageType: 'BAG_25KG', bags: '12.5' })).toThrow('Bag 25 kg requires a whole-number bag count');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd run test:unit -- purchase-orders-api.test.js purchase-order-shipment.test.js`

Expected: FAIL because PO creation has no shipment snapshot support.

- [ ] **Step 3: Implement PO selection and snapshot trigger**

Add a Shipment Configuration selector. Jumbobag/Bulk show fixed MT and hide Bags; Bag 25 kg requires an integer count and previews MT. Add a `before insert or update` PO trigger: reject inactive config; copy fixed/Bulk MT+tolerance; calculate Bag 25 kg MT as `shipment_bags_per_container * 25 / 1000`.

Extend pgTAP with `850 x 28 = 23.8`, `25 x 800 = 20`, and Bulk `20 MT +/-5%` snapshot tests. Document the three package rules and historic snapshot rule in `README.md` and `docs/deployment.md`.

- [ ] **Step 4: Run all verification**

Run: `npm.cmd run test:unit; npm.cmd run build; supabase db reset; supabase test db`

Expected: all checks pass and `dist` is built.

- [ ] **Step 5: Apply, check, and commit**

Apply `20260811170000_normalize_shipment_configurations.sql` with the Supabase migration tool. Query the normalized configurations and confirm all Jumbobag MT values are calculated, Bulk retains direct MT/tolerance, and invalid legacy container rows are inactive. Then run: `git add src/lib/purchase-orders-api.js src/views/purchase-orders.js tests/unit/purchase-orders-api.test.js tests/unit/purchase-order-shipment.test.js supabase/tests/0013_shipment_configuration_master.test.sql README.md docs/deployment.md; git commit -m "feat: snapshot shipment loads on purchase orders"; git push origin HEAD`.
