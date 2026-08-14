# Purchase Order Dependent Selectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw Purchase Order IDs and the flat shipment-configuration list with clear, dependent selections that persist the same protected configuration snapshot.

**Architecture:** The browser will load products, their approved specs, and active shipment configurations, then derive each dependent select from a small pure helper module. The PO still inserts a single configuration UUID; database triggers remain the authority for the immutable load snapshot. A migration will additionally seed the Liner variant and preserve an explicit MT / Shipment supplied for Bulk Vessel and Truck configurations.

**Tech Stack:** Vanilla ES modules, Vite, Vitest, PostgreSQL/pgTAP, Supabase migrations and RLS.

## Global Constraints

- The browser uses only the existing Supabase anon/publishable configuration; no service-role key is permitted.
- Product options are active products; spec options are limited to `APPROVED` specs belonging to the selected product.
- Shipment controls are selected in this order: Shipment Type, Container Type when applicable, Package, then No. of Bags when applicable.
- Package choices are Jumbobag 850/950/1,200 kg, 25 kg Bag, Bulk Container, or Bulk Container + Liner. Only Jumbobag choices expose configured bag counts.
- 25 kg Bag accepts a positive whole-number bag count. Bulk Vessel and Truck accept a positive manual MT / Shipment and never show a bag count.
- Container Bulk and Bulk + Liner are fixed at 20 MT with a 5% tolerance. The client resolves a choice to one active `shipment_configurations.id`; the database trigger stores the trusted snapshot.
- Do not edit, stage, or commit `Data/`, `2026-08-11-wcat-sales-support-webapp-design.md`, or `WCAT_Sales_Support_WebApp_MVP_Requirements_v7.md`.

---

## File Structure

- `src/lib/po-form-options.js` — pure filters and labels for shipment type, container, package, bag, and final configuration resolution.
- `src/lib/purchase-orders-api.js` — client validation and insert payload, including a manual MT / Shipment value for Bulk Vessel/Truck.
- `src/views/purchase-orders.js` — product/spec selects and the progressive shipment fields.
- `tests/unit/po-form-options.test.js` — deterministic dependent-selector tests.
- `tests/unit/purchase-orders-api.test.js` — validation and payload tests for manual MT / Shipment.
- `tests/unit/purchase-orders-view.test.js` — browser-view contract for friendly selectors.
- `supabase/migrations/<timestamp>_po_shipment_selector_rules.sql` — seed the Liner configuration and update PO load snapshot trigger.
- `supabase/tests/0013_shipment_configuration_master.test.sql` — pgTAP assertions for Liner availability and manual shipment MT snapshot.

### Task 1: Persist the Shipment Rules in the Database

**Files:**
- Create: `supabase/migrations/<timestamp>_po_shipment_selector_rules.sql`
- Modify: `supabase/tests/0013_shipment_configuration_master.test.sql`

**Interfaces:**
- Consumes: `shipment_configurations` and `purchase_orders` from `20260811170000_normalize_shipment_configurations.sql`.
- Produces: an active `Container / 20' / Bulk Container + Liner` configuration with `20.000 MT` and `5.000%`, plus `snapshot_po_shipment_load()` that accepts manual MT for `Bulk Vessel` and `Truck`.

- [ ] **Step 1: Write failing pgTAP assertions**

  Add two assertions and increase the plan count from 9 to 11. The first must prove that exactly one active Liner configuration exists. The second must insert a PO using the existing active `Bulk Vessel` configuration with `shipment_mt_per_container = 500`, then prove the trigger preserves `500.000` rather than replacing it with the legacy configuration's zero value.

  ```sql
  SELECT is(
    (SELECT count(*)::integer FROM public.shipment_configurations
      WHERE shipment_mode = 'Container' AND container_type = '20'''
        AND package = 'Bulk Container + Liner' AND is_active),
    1,
    'one active Bulk Container + Liner configuration exists'
  );
  ```

- [ ] **Step 2: Run the focused database test and verify it fails**

  Run:

  ```powershell
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\supabase\\dist\\supabase.js' test db --local supabase/tests/0013_shipment_configuration_master.test.sql
  ```

  Expected: FAIL because the Liner configuration and manual-MT trigger branch do not exist.

- [ ] **Step 3: Create the migration and implement the minimum database rules**

  First create the migration file through the Supabase CLI:

  ```powershell
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\supabase\\dist\\supabase.js' migration new po_shipment_selector_rules
  ```

  In the generated file, insert the active Liner row only if none exists with the same Container/20'/package key. Replace `public.snapshot_po_shipment_load()` so it validates the chosen configuration is active and performs these branches:

  ```sql
  IF c.package_type = 'BAG_25KG' THEN
    IF coalesce(NEW.shipment_bags_per_container, 0) <= 0
       OR NEW.shipment_bags_per_container <> trunc(NEW.shipment_bags_per_container) THEN
      RAISE EXCEPTION '25 kg bag configuration requires a positive whole-number bag count';
    END IF;
    NEW.shipment_mt_per_container := round((NEW.shipment_bags_per_container * 25)::numeric / 1000, 3);
  ELSIF c.shipment_mode IN ('Bulk Vessel', 'Truck') THEN
    IF coalesce(NEW.shipment_mt_per_container, 0) <= 0 THEN
      RAISE EXCEPTION '% configuration requires a positive MT / Shipment value', c.shipment_mode;
    END IF;
    NEW.shipment_bags_per_container := NULL;
    NEW.shipment_tolerance_percent := coalesce(c.tolerance_percent, 0);
  ELSE
    NEW.shipment_bags_per_container := c.bags_per_container;
    NEW.shipment_mt_per_container := c.standard_mt_per_container;
  END IF;
  ```

- [ ] **Step 4: Reset local Supabase and run the focused test**

  Run:

  ```powershell
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\supabase\\dist\\supabase.js' db reset
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\supabase\\dist\\supabase.js' test db --local supabase/tests/0013_shipment_configuration_master.test.sql
  ```

  Expected: PASS, including 20 MT ±5% Liner and the 500 MT manual snapshot.

- [ ] **Step 5: Commit the database rule**

  ```powershell
  git add supabase/migrations supabase/tests/0013_shipment_configuration_master.test.sql
  git commit -m "feat: support liner and manual shipment loads"
  ```

### Task 2: Add Pure Dependent-Selector Helpers

**Files:**
- Create: `src/lib/po-form-options.js`
- Create: `tests/unit/po-form-options.test.js`

**Interfaces:**
- Consumes: active configuration objects with `id`, `shipment_mode`, `container_type`, `package`, `package_type`, `jumbobag_id`, `bags_per_container`, `standard_mt_per_container`, and `jumbobag_master.weight_kg`.
- Produces: `listShipmentTypes(configurations)`, `listContainerTypes(configurations, shipmentType)`, `listPackages(configurations, shipmentType, containerType)`, `listBagOptions(configurations, selection)`, and `resolveShipmentConfiguration(configurations, selection)`.

- [ ] **Step 1: Write failing selector tests**

  Use a local fixture containing Jumbobag 850 kg with two bag counts, Bag 25 kg, Bulk Container, Bulk Container + Liner, Bulk Vessel, and Truck. Assert that Container exposes `20'`, Jumbobag labels include their weight, only configured Jumbobag bag counts appear, 25 kg/Bulk choices contain no bag choices, and a completed selection resolves to exactly one UUID.

  ```js
  expect(listPackages(configurations, 'Container', "20'").map(({ label }) => label))
    .toEqual(['Jumbobag 850 kg', 'Bag 25 kg', 'Bulk Container', 'Bulk Container + Liner']);
  expect(listBagOptions(configurations, jumboSelection).map(({ value }) => value)).toEqual(['20', '22']);
  expect(resolveShipmentConfiguration(configurations, jumboSelection)).toMatchObject({ id: 'jumbo-20' });
  ```

- [ ] **Step 2: Run the new unit test and verify it fails**

  Run:

  ```powershell
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\vitest\\vitest.mjs' run tests/unit/po-form-options.test.js
  ```

  Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement the smallest pure helper module**

  Implement each function using active configurations only, stable alphabetical/numeric ordering, and the following package key convention so equal package text with a different Jumbobag stays distinct:

  ```js
  export function packageKey(configuration) {
    return `${configuration.package_type}:${configuration.package}:${configuration.jumbobag_id ?? ''}`;
  }

  export function packageLabel(configuration) {
    const weight = configuration.jumbobag_master?.weight_kg;
    return configuration.package_type === 'JUMBOBAG' && weight
      ? `Jumbobag ${Number(weight).toLocaleString('en-US')} kg`
      : configuration.package;
  }
  ```

  `resolveShipmentConfiguration()` must return `null` until the required type/container/package/bag parts are selected. It must never derive MT; that stays in the database trigger.

- [ ] **Step 4: Run the helper unit test and the full unit suite**

  Run:

  ```powershell
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\vitest\\vitest.mjs' run tests/unit/po-form-options.test.js
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\vitest\\vitest.mjs' run
  ```

  Expected: PASS.

- [ ] **Step 5: Commit the helper module**

  ```powershell
  git add src/lib/po-form-options.js tests/unit/po-form-options.test.js
  git commit -m "feat: add dependent shipment selector helpers"
  ```

### Task 3: Update PO Validation, Payload, and Form

**Files:**
- Modify: `src/lib/purchase-orders-api.js`
- Modify: `src/views/purchase-orders.js`
- Modify: `tests/unit/purchase-orders-api.test.js`
- Modify: `tests/unit/purchase-orders-view.test.js`

**Interfaces:**
- Consumes: `listProductSpecs()`, `listShipmentConfigurations()`, and Task 2 selector helpers.
- Produces: a PO form with `productId`, `specId`, shipment type/container/package/bag UI state, one resolved `shipmentConfigurationId`, and optional `manualShipmentMt`.

- [ ] **Step 1: Write failing API tests**

  Extend the API test fixture to submit a Bulk Vessel PO. Assert that `createPurchaseOrder()` inserts `shipment_mt_per_container: 500`, accepts a positive manual MT, and rejects missing or zero manual MT for a `Bulk Vessel` or `Truck` configuration.

  ```js
  expect(() => validateShipmentSelection({
    packageType: 'LEGACY', shipmentType: 'Bulk Vessel', mtPerShipment: ''
  })).toThrow('Bulk Vessel requires a positive MT / Shipment value');
  ```

- [ ] **Step 2: Run the API test and verify it fails**

  Run:

  ```powershell
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\vitest\\vitest.mjs' run tests/unit/purchase-orders-api.test.js
  ```

  Expected: FAIL because manual shipment MT is neither validated nor sent in the payload.

- [ ] **Step 3: Implement client payload validation**

  Change `validateShipmentSelection()` to accept `{ packageType, shipmentType, bags, mtPerShipment }`. Keep the existing positive integer requirement for `BAG_25KG`; for `Bulk Vessel` and `Truck`, require `Number(mtPerShipment) > 0`; leave fixed Container configurations to the database. Add this value to the insert payload only when supplied:

  ```js
  shipment_mt_per_container: values.manualShipmentMt === '' || values.manualShipmentMt == null
    ? null
    : Number(values.manualShipmentMt),
  ```

- [ ] **Step 4: Write failing view assertions**

  Update the PO view test setup so it returns two active products, approved and draft specs, and the configuration fixture. Assert that the rendered form has `select[name="productId"]`, disabled `select[name="specId"]` before product selection, `select[name="shipmentType"]`, and does not render the old flat `Shipment Configuration` label.

  ```js
  expect(container.querySelector('select[name="productId"] option').textContent).toContain('PROD-001');
  expect(container.querySelector('select[name="specId"]').disabled).toBe(true);
  expect(container.textContent).not.toContain('Shipment Configuration');
  ```

- [ ] **Step 5: Run the view test and verify it fails**

  Run:

  ```powershell
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\vitest\\vitest.mjs' run tests/unit/purchase-orders-view.test.js
  ```

  Expected: FAIL because the view still renders raw Product ID, Spec ID, and flat configurations.

- [ ] **Step 6: Implement progressive PO controls**

  In `renderPurchaseOrders()`, load product/spec data before first render and make product options use `code — name`. Filter Specs to the selected active product with `status === 'APPROVED'`; clear and disable the spec select whenever the product changes.

  Render shipment controls in this exact sequence:

  ```text
  Shipment Type → Container Type (Container only) → Package → No. of Bags (Jumbobag only)
  ```

  Use Task 2 to regenerate downstream controls after every change. For Bag 25 kg show an integer `Bags` input and live calculated MT. For Bulk Vessel/Truck show only a required numeric `MT / Shipment` input. For every fixed configuration show its calculated `MT / Container` and tolerance. Keep the resolved UUID in the existing hidden `shipmentConfigurationId` field and set `shipmentPackageType` from that configuration so the API validation and database trigger receive the correct contract.

- [ ] **Step 7: Run all frontend tests and production build**

  Run:

  ```powershell
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\vitest\\vitest.mjs' run
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\vite\\bin\\vite.js' build
  ```

  Expected: PASS and a `dist/` production build.

- [ ] **Step 8: Commit the PO form**

  ```powershell
  git add src/lib/purchase-orders-api.js src/views/purchase-orders.js tests/unit/purchase-orders-api.test.js tests/unit/purchase-orders-view.test.js
  git commit -m "feat: add dependent PO product and shipment selectors"
  ```

### Task 4: Verify, Deploy Database Change, and Record the Result

**Files:**
- Modify: `README.md` only if the existing PO workflow section needs the new selection instructions.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified local checks and an applied production migration before Cloudflare deploy is triggered by the merged branch.

- [ ] **Step 1: Run the complete local verification cycle**

  Run:

  ```powershell
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\supabase\\dist\\supabase.js' db reset
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\supabase\\dist\\supabase.js' test db --local supabase/tests
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\vitest\\vitest.mjs' run
  & 'C:\\Users\\Ma Deaw\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' '.\\node_modules\\vite\\bin\\vite.js' build
  ```

  Expected: all SQL tests, all unit tests, and production build pass.

- [ ] **Step 2: Apply the reviewed migration to Supabase production**

  Apply exactly the migration SQL from Task 1 through the Supabase migration tool to project `qopretpbnebzyhwlanps`. Do not apply any unrelated schema changes.

- [ ] **Step 3: Commit final documentation if changed**

  ```powershell
  git add README.md
  git commit -m "docs: explain PO shipment selection" 
  ```

  Skip this commit if no README update is necessary.

## Review Checklist

- Product and Spec selectors never show raw UUIDs and draft specs never appear.
- The shipment form never exposes a bag count for Bulk Container, Bulk Container + Liner, Bulk Vessel, or Truck.
- Jumbobag uses only persisted configuration bag counts; 25 kg Bag accepts manual whole bags; Bulk Vessel/Truck require manual MT / Shipment.
- Exactly one active Liner configuration is seeded at 20 MT with 5% tolerance.
- A manual Bulk Vessel/Truck MT is not overwritten by the PO snapshot trigger.
- No browser changes introduce a secret key; all tests and Vite build are green before deployment.
