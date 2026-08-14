begin;
select plan(17);

create temp table final_fix_fixture on commit drop as
with auth_identity as (
  insert into auth.users(id, email, created_at, updated_at)
  values (gen_random_uuid(), 'po-final-fix-auth@example.com', now(), now())
  returning id
), profile as (
  insert into public.user_profiles(email, auth_user_id, role)
  select 'po-final-fix@example.com', id, 'ADMIN' from auth_identity
  returning id, auth_user_id
), customer as (
  insert into public.customers(name, source, status)
  values ('PO Final Fix Customer', 'DIRECT_WCAT', 'ACTIVE_CUSTOMER')
  returning id
), active_product as (
  insert into public.products(code, name, is_active)
  values ('PO-FINAL-ACTIVE', 'PO Final Active Product', true)
  returning id
), other_product as (
  insert into public.products(code, name, is_active)
  values ('PO-FINAL-OTHER', 'PO Final Other Product', true)
  returning id
), inactive_product as (
  insert into public.products(code, name, is_active)
  values ('PO-FINAL-INACTIVE', 'PO Final Inactive Product', false)
  returning id
), approved_spec as (
  insert into public.product_specs(product_id, name, version, status)
  select id, 'Approved Spec', 'v1', 'APPROVED' from active_product
  returning id
), other_approved_spec as (
  insert into public.product_specs(product_id, name, version, status)
  select id, 'Other Approved Spec', 'v1', 'APPROVED' from other_product
  returning id
), draft_spec as (
  insert into public.product_specs(product_id, name, version, status)
  select id, 'Draft Spec', 'draft', 'DRAFT' from active_product
  returning id
), inactive_spec as (
  insert into public.product_specs(product_id, name, version, status)
  select id, 'Inactive Spec', 'inactive', 'INACTIVE' from active_product
  returning id
), inactive_product_spec as (
  insert into public.product_specs(product_id, name, version, status)
  select id, 'Approved Spec', 'v1', 'APPROVED' from inactive_product
  returning id
), snapshot_configuration as (
  insert into public.shipment_configurations(
    shipment_mode, container_type, package, package_type,
    standard_mt_per_container, tolerance_percent, is_active
  ) values ('Container', 'snapshot-test', 'Snapshot Bulk', 'BULK_CONTAINER', 20, 5, true)
  returning id
), inactive_configuration as (
  insert into public.shipment_configurations(
    shipment_mode, container_type, package, package_type,
    standard_mt_per_container, tolerance_percent, is_active
  ) values ('Container', 'inactive-test', 'Inactive Bulk', 'BULK_CONTAINER', 19, 4, false)
  returning id
), validation_configuration as (
  insert into public.shipment_configurations(
    shipment_mode, container_type, package, package_type,
    standard_mt_per_container, tolerance_percent, is_active
  ) values ('Container', 'validation-test', 'Validation Bulk', 'BULK_CONTAINER', 18, 3, true)
  returning id
)
select
  profile.id as profile_id,
  profile.auth_user_id,
  customer.id as customer_id,
  active_product.id as active_product_id,
  other_product.id as other_product_id,
  inactive_product.id as inactive_product_id,
  approved_spec.id as approved_spec_id,
  other_approved_spec.id as other_approved_spec_id,
  draft_spec.id as draft_spec_id,
  inactive_spec.id as inactive_spec_id,
  inactive_product_spec.id as inactive_product_spec_id,
  snapshot_configuration.id as snapshot_configuration_id,
  inactive_configuration.id as inactive_configuration_id,
  validation_configuration.id as validation_configuration_id
from profile
cross join customer
cross join active_product
cross join other_product
cross join inactive_product
cross join approved_spec
cross join other_approved_spec
cross join draft_spec
cross join inactive_spec
cross join inactive_product_spec
cross join snapshot_configuration
cross join inactive_configuration
cross join validation_configuration;

create temp table final_fix_po_fixture on commit drop as
with usd_po as (
  insert into public.purchase_orders(
    customer_id, customer_po_number, po_date, product_id, product_spec_id,
    shipment_configuration_id, contract_quantity_mt, incoterm, destination,
    currency, final_selling_price, created_by
  )
  select customer_id, 'PO-FINAL-USD', current_date, active_product_id, approved_spec_id,
    snapshot_configuration_id, 1, 'FOB', 'Original USD destination',
    'USD', 100, profile_id
  from final_fix_fixture
  returning id
), eur_po as (
  insert into public.purchase_orders(
    customer_id, customer_po_number, po_date, product_id, product_spec_id,
    shipment_configuration_id, contract_quantity_mt, incoterm, destination,
    currency, final_selling_price, fx_rate, created_by
  )
  select customer_id, 'PO-FINAL-EUR', current_date, active_product_id, approved_spec_id,
    snapshot_configuration_id, 1, 'FOB', 'Original EUR destination',
    'EUR', 100, 1, profile_id
  from final_fix_fixture
  returning id
)
select usd_po.id as usd_po_id, eur_po.id as eur_po_id
from usd_po
cross join eur_po;

update public.shipment_configurations
set standard_mt_per_container = 25,
    tolerance_percent = 7,
    is_active = false
where id = (select snapshot_configuration_id from final_fix_fixture);

select lives_ok(
  $$update public.purchase_orders
    set destination = 'Updated unrelated destination'
    where id = (select usd_po_id from final_fix_po_fixture)$$,
  'unrelated PO updates remain possible after shipment master mutation and deactivation'
);
select lives_ok(
  $$select *
    from public.evaluate_po_commercial((select usd_po_id from final_fix_po_fixture))$$,
  'commercial evaluation remains compatible with an inactive snapshotted shipment configuration'
);

do $block$
begin
  perform set_config(
    'request.jwt.claim.sub',
    (select auth_user_id::text from final_fix_fixture),
    true
  );
end;
$block$;

select lives_ok(
  $$select public.approve_po_fx(
      (select eur_po_id from final_fix_po_fixture),
      1.250000,
      'Final Fix Bank',
      current_date
    )$$,
  'FX approval remains compatible with an inactive snapshotted shipment configuration'
);
select lives_ok(
  $$update public.purchase_orders
    set shipment_bags_per_container = 99,
        shipment_mt_per_container = 999,
        shipment_tolerance_percent = 99
    where id = (select usd_po_id from final_fix_po_fixture)$$,
  'fixed-load snapshot-output tampering is ignored while its master configuration is inactive'
);
select throws_ok(
  $$update public.purchase_orders
    set shipment_configuration_id = (select inactive_configuration_id from final_fix_fixture)
    where id = (select usd_po_id from final_fix_po_fixture)$$,
  'P0001',
  'Shipment Configuration must be active',
  'changing a PO selection to an inactive shipment configuration is rejected'
);
select ok(
  (select shipment_bags_per_container is null
    from public.purchase_orders
    where id = (select usd_po_id from final_fix_po_fixture)),
  'unrelated and evaluation updates preserve the original null bag snapshot'
);
select is(
  (select shipment_mt_per_container
    from public.purchase_orders
    where id = (select usd_po_id from final_fix_po_fixture)),
  20.000::numeric,
  'unrelated and evaluation updates preserve the original MT snapshot'
);
select is(
  (select shipment_tolerance_percent
    from public.purchase_orders
    where id = (select usd_po_id from final_fix_po_fixture)),
  5.000::numeric,
  'unrelated and evaluation updates preserve the original tolerance snapshot'
);
select ok(
  (select shipment_bags_per_container is null
    from public.purchase_orders
    where id = (select eur_po_id from final_fix_po_fixture)),
  'FX approval preserves the original null bag snapshot'
);
select is(
  (select shipment_mt_per_container
    from public.purchase_orders
    where id = (select eur_po_id from final_fix_po_fixture)),
  20.000::numeric,
  'FX approval preserves the original MT snapshot'
);
select is(
  (select shipment_tolerance_percent
    from public.purchase_orders
    where id = (select eur_po_id from final_fix_po_fixture)),
  5.000::numeric,
  'FX approval preserves the original tolerance snapshot'
);
update public.shipment_configurations
set is_active = true
where id = (select snapshot_configuration_id from final_fix_fixture);
select lives_ok(
  $$update public.purchase_orders
    set shipment_bags_per_container = 99,
        shipment_mt_per_container = 999,
        shipment_tolerance_percent = 99
    where id = (select usd_po_id from final_fix_po_fixture)$$,
  'fixed-load snapshot-output tampering is ignored while mutated master data is active'
);
select is(
  (select jsonb_build_object(
      'bags', shipment_bags_per_container,
      'mt', shipment_mt_per_container,
      'tolerance', shipment_tolerance_percent
    )
    from public.purchase_orders
    where id = (select usd_po_id from final_fix_po_fixture)),
  '{"bags": null, "mt": 20.000, "tolerance": 5.000}'::jsonb,
  'fixed-load snapshot-output tampering cannot resnapshot mutated master values'
);

select throws_ok(
  $$insert into public.purchase_orders(
      customer_id, customer_po_number, po_date, product_id, product_spec_id,
      shipment_configuration_id, contract_quantity_mt, incoterm, destination,
      currency, final_selling_price, created_by
    )
    select customer_id, 'PO-FINAL-MISMATCH', current_date, active_product_id, other_approved_spec_id,
      validation_configuration_id, 1, 'FOB', 'Mismatch', 'USD', 100, profile_id
    from final_fix_fixture$$,
  'P0001',
  'Product must be active and Product Spec must be APPROVED for that Product',
  'database rejects a Product Spec belonging to another Product'
);
select throws_ok(
  $$insert into public.purchase_orders(
      customer_id, customer_po_number, po_date, product_id, product_spec_id,
      shipment_configuration_id, contract_quantity_mt, incoterm, destination,
      currency, final_selling_price, created_by
    )
    select customer_id, 'PO-FINAL-DRAFT', current_date, active_product_id, draft_spec_id,
      validation_configuration_id, 1, 'FOB', 'Draft', 'USD', 100, profile_id
    from final_fix_fixture$$,
  'P0001',
  'Product must be active and Product Spec must be APPROVED for that Product',
  'database rejects a Draft Product Spec'
);
select throws_ok(
  $$insert into public.purchase_orders(
      customer_id, customer_po_number, po_date, product_id, product_spec_id,
      shipment_configuration_id, contract_quantity_mt, incoterm, destination,
      currency, final_selling_price, created_by
    )
    select customer_id, 'PO-FINAL-INACTIVE-PRODUCT', current_date, inactive_product_id, inactive_product_spec_id,
      validation_configuration_id, 1, 'FOB', 'Inactive product', 'USD', 100, profile_id
    from final_fix_fixture$$,
  'P0001',
  'Product must be active and Product Spec must be APPROVED for that Product',
  'database rejects an inactive Product'
);
select throws_ok(
  $$insert into public.purchase_orders(
      customer_id, customer_po_number, po_date, product_id, product_spec_id,
      shipment_configuration_id, contract_quantity_mt, incoterm, destination,
      currency, final_selling_price, created_by
    )
    select customer_id, 'PO-FINAL-INACTIVE-SPEC', current_date, active_product_id, inactive_spec_id,
      validation_configuration_id, 1, 'FOB', 'Inactive spec', 'USD', 100, profile_id
    from final_fix_fixture$$,
  'P0001',
  'Product must be active and Product Spec must be APPROVED for that Product',
  'database rejects an Inactive Product Spec'
);

select * from finish();
rollback;
