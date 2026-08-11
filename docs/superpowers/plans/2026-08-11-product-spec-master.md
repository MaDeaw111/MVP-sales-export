# Product Spec Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import 12 approved technical product specifications and give Admin a safe Product & Spec maintenance page.

**Architecture:** Keep approved technical limits in `product_specs.parameters` JSON and show each specification with its product. Admin can edit only non-technical product master fields; a technical change creates a distinct product code and an approved `1.0` spec. Existing RLS policies remain authoritative.

**Tech Stack:** Vanilla ES modules, `@supabase/supabase-js`, Vitest, Supabase Postgres/RLS.

## Global Constraints

- Import only `PROD-001` through `PROD-012` from `Data/Product_Spec.xlsx`; ignore blank rows.
- Imported specs use `APPROVED`, version `1.0`, and never overwrite an existing approved spec.
- Technical values are immutable after approval; changed values require a new product code.
- Only Admin may modify product master data or create a derived product.
- Do not expose a service-role key in browser code.

---

### Task 1: Add product/specification data functions

**Files:**
- Modify: `src/lib/products-api.js`
- Modify: `tests/unit/products-api.test.js`

**Interfaces:**
- Produces `listProductSpecs(supabase)`, `updateProductMaster(supabase, id, values)`, and `createProductFromSpec(supabase, values)`.
- `listProductSpecs` returns product columns plus `product_specs(id,name,version,status,parameters,note)`.
- `createProductFromSpec` inserts a product and a `product_specs` row with `status: 'APPROVED'` and `version: '1.0'`.

- [ ] **Step 1: Write failing API tests**

```js
it('lists products with their approved technical specification', async () => {
  let table;
  const supabase = { from: (value) => { table = value; return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }; } };
  await listProductSpecs(supabase);
  expect(table).toBe('products');
});

it('updates only non-technical product master fields', async () => {
  let payload;
  const supabase = { from: () => ({ update: (value) => { payload = value; return { eq: () => Promise.resolve({ error: null }) }; } }) };
  await updateProductMaster(supabase, 'product-1', { name: 'New name', shortName: 'NEW', remark: 'Updated' });
  expect(payload).toMatchObject({ name: 'New name', description: 'Short name: NEW', remark: 'Updated' });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm.cmd run test:unit -- products-api.test.js`

Expected: FAIL because the new API functions do not exist.

- [ ] **Step 3: Implement the API functions**

```js
export async function listProductSpecs(supabase) {
  const { data, error } = await supabase
    .from('products')
    .select('id,code,name,description,remark,is_active,product_specs(id,name,version,status,parameters,note)')
    .order('code');
  if (error) throw error;
  return data;
}
```

Validate `name` and `shortName` in `updateProductMaster`. In `createProductFromSpec`, reject an empty code or name, insert the product, then insert exactly one approved `1.0` spec with the copied technical JSON.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm.cmd run test:unit -- products-api.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/products-api.js tests/unit/products-api.test.js
git commit -m "feat: add product specification master API"
```

### Task 2: Build the Admin Product & Spec page

**Files:**
- Modify: `src/views/products.js`
- Modify: `src/styles/app.css`
- Modify: `tests/unit/products-api.test.js`

**Interfaces:**
- Consumes `listProductSpecs`, `updateProductMaster`, and `createProductFromSpec`.
- Produces a product/specification list where technical JSON is read-only and Admin controls require `profile.role === 'ADMIN'`.

- [ ] **Step 1: Write failing validation tests**

```js
it('does not place technical limits in the product master update payload', () => {
  expect(buildProductMasterPayload({ name: 'TRP', shortName: 'TRP', remark: '' }))
    .toEqual({ name: 'TRP', shortName: 'TRP', remark: '' });
});

it('requires a new code for a derived product', () => {
  expect(() => validateDerivedProduct({ code: '', name: 'TRP replacement', parameters: { starch_min: 0.45 } }))
    .toThrow('Product code and name are required');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm.cmd run test:unit -- products-api.test.js`

Expected: FAIL because the validators do not exist.

- [ ] **Step 3: Implement the list/detail workflow**

Render Code, Name, Short Name, Approval, and a technical-limit summary. Selecting a product opens a detail panel. For Admin, provide an `Edit product master` form with only Name, Short name, and Remark plus a `Create new product from this spec` form with a required new Code, Name, Short name, Remark, and technical numeric fields. Existing approved technical fields must render read-only.

- [ ] **Step 4: Run the focused test and production build**

Run: `npm.cmd run test:unit -- products-api.test.js; npm.cmd run build`

Expected: all focused tests PASS and Vite emits `dist`.

- [ ] **Step 5: Commit**

```powershell
git add src/views/products.js src/styles/app.css src/lib/products-api.js tests/unit/products-api.test.js
git commit -m "feat: manage approved product specs safely"
```

### Task 3: Import approved workbook data

**Files:**
- Modify: `docs/deployment.md`

**Interfaces:**
- Consumes twelve completed rows in `Data/Product_Spec.xlsx`.
- Produces one `APPROVED` `1.0` specification per existing product code.

- [ ] **Step 1: Verify the pre-import state**

```sql
select p.code, count(s.id) as approved_specs
from public.products p
left join public.product_specs s
  on s.product_id = p.id and s.status = 'APPROVED'
where p.code between 'PROD-001' and 'PROD-012'
group by p.code
order by p.code;
```

Expected: twelve rows with `approved_specs = 0`.

- [ ] **Step 2: Run the idempotent mapped import with the remote Supabase SQL tool**

```sql
with source(code, name, short_name, starch_min, moisture_max, sand_silica_max, crude_fiber_max, crude_protein, crude_fat_max, ash_max) as (
  values
    ('PROD-001','Tapioca Residue Pellet 45% Sand 4%','TRP_45_4',0.45,0.14,0.04,0.155,null,null,null),
    ('PROD-002','Organic Tapioca Residue Pellet 48% Sand 3%','OTRP_48_3',0.48,0.14,0.03,0.145,null,null,null),
    ('PROD-003','Tapioca Residue Pellet 60% Sand 3%','TRP_60_3',0.60,0.14,null,null,null,null,null),
    ('PROD-004','Tapioca Residue Pellet 60% Sand 1%','TRP_60_1',0.60,0.14,null,null,null,null,null),
    ('PROD-005','Tapioca Hard Pellet 65% Sand 4%','THP_65_4',0.65,0.14,0.04,0.05,null,null,null),
    ('PROD-006','Tapioca Hard Pellet 65% Sand 1%','THP_65_1',0.65,0.14,0.01,0.05,null,null,null),
    ('PROD-007','Tapioca Hard Pellet 68% Sand 3%','THP_68_3',0.68,0.14,0.03,0.05,null,null,null),
    ('PROD-008','Sweet Potato Pellet','SW_P',0.55,0.14,0.03,0.05,0.04,0.02,0.05),
    ('PROD-009','Pumpkin Pellet','PUM_P',0.25,0.14,0.02,0.10,0.125,null,null),
    ('PROD-010','Sweet Potato Powder','SW_Pow',0.55,0.14,0.03,0.05,0.04,0.02,0.05),
    ('PROD-011','Tapioca Residue Powder 62.5%','TR_Pow_62.5_3',0.625,0.14,0.03,null,null,null,null),
    ('PROD-012','Tapioca Residue Powder 60%','TR_Pow_60_3',0.60,0.14,0.03,null,null,null,null)
)
insert into public.product_specs(product_id, name, version, status, effective_date, parameters, note)
select p.id, s.name, '1.0', 'APPROVED', current_date,
  jsonb_build_object(
    'short_name', s.short_name, 'starch_min', s.starch_min, 'moisture_max', s.moisture_max,
    'sand_silica_max', s.sand_silica_max, 'crude_fiber_max', s.crude_fiber_max,
    'crude_protein', s.crude_protein, 'crude_fat_max', s.crude_fat_max, 'ash_max', s.ash_max
  ),
  'Imported from Product_Spec.xlsx'
from source s
join public.products p on p.code = s.code
on conflict (product_id, version) do nothing;
```

- [ ] **Step 3: Verify every imported specification**

```sql
select p.code, s.version, s.status, s.parameters
from public.products p
join public.product_specs s on s.product_id = p.id
where p.code between 'PROD-001' and 'PROD-012'
order by p.code;
```

Expected: twelve rows, each version `1.0`, status `APPROVED`, and numeric JSON values from the workbook.

- [ ] **Step 4: Document the import source and safety rule**

Add a `Product Spec master data` section to `docs/deployment.md` that identifies the workbook, imported codes, and the requirement to create a new code for any technical change.

- [ ] **Step 5: Commit**

```powershell
git add docs/deployment.md
git commit -m "docs: record approved product spec import"
```

### Task 4: Verify and release

**Files:**
- Verify: `tests/unit/products-api.test.js`
- Verify: `src/views/products.js`
- Verify: `docs/deployment.md`

- [ ] **Step 1: Run the complete local verification suite**

Run: `npm.cmd run test:unit; npm.cmd run build`

Expected: all unit tests PASS and `dist` builds successfully.

- [ ] **Step 2: Verify Admin behavior in production**

Open `https://wcat-sales-support.pages.dev`, sign in as Admin, open Products & Specs, confirm a completed row shows approved `1.0` read-only technical data, then save a non-technical product edit and verify it persists after reload.

- [ ] **Step 3: Push the production branch**

```powershell
git push origin main
```

Expected: Cloudflare Pages starts an automatic deployment from `main`.

- [ ] **Step 4: Verify the deployed sign-in page**

Open `https://wcat-sales-support.pages.dev` and confirm it loads with no configuration error.
