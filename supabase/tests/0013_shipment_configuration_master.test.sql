begin;
select plan(11);

select ok(to_regclass('public.jumbobag_master') is not null, 'Jumbobag master exists');
select is((select count(*)::int from public.jumbobag_master where is_active), 3, 'three active Jumbobag weights are seeded');
select ok(exists(select 1 from pg_trigger where tgname = 'sync_shipment_configuration'), 'configuration calculation trigger exists');
select ok(exists(select 1 from pg_trigger where tgname = 'snapshot_po_shipment_load'), 'PO shipment snapshot trigger exists');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'jumbobag_master' and policyname = 'admins manage jumbobags'), 'Admin master-data policy exists');
select is(
  (select count(*)::integer from public.shipment_configurations
    where shipment_mode = 'Container' and container_type = '20'
      and package = 'Bulk Container + Liner' and is_active),
  1,
  'one active Bulk Container + Liner configuration exists'
);
select lives_ok(
  $$insert into public.shipment_configurations(shipment_mode, container_type, package, package_type, jumbobag_id, bags_per_container, standard_mt_per_container, is_active)
    select 'Container', 'test', 'Jumbobag', 'JUMBOBAG', id, 28, 0, false from public.jumbobag_master where weight_kg = 850$$,
  'allows a valid Jumbobag configuration'
);
select is(
  (select standard_mt_per_container from public.shipment_configurations where container_type = 'test' and package_type = 'JUMBOBAG'),
  23.8::numeric,
  'Jumbobag MT is calculated by the database'
);
select throws_ok(
  $$insert into public.shipment_configurations(shipment_mode, container_type, package, package_type, standard_mt_per_container, is_active) values ('Container', 'test-bulk', 'Bulk Container', 'BULK_CONTAINER', 0, false)$$,
  'P0001',
  'Bulk Container requires MT per Container',
  'Bulk Container requires direct MT'
);
select is(
  (select count(*)::int from public.shipment_configurations where package_type = 'BULK_CONTAINER' and is_active),
  2,
  'both standard and Liner Bulk Container configurations are active'
);
insert into public.shipment_configurations(
  shipment_mode, container_type, package, package_type, standard_mt_per_container, is_active
) values ('Bulk Vessel', 'N/A', 'Bulk Vessel', 'LEGACY', 0, true);
create temp table shipment_test_result on commit drop as
with profile as (
  insert into public.user_profiles(email, role)
  values ('shipment-test@example.com', 'ADMIN')
  returning id
), customer as (
  insert into public.customers(name, source, status)
  values ('Shipment Test Customer', 'DIRECT_WCAT', 'ACTIVE_CUSTOMER')
  returning id
), product as (
  insert into public.products(code, name)
  values ('SHIPMENT-TEST', 'Shipment Test Product')
  returning id
), spec as (
  insert into public.product_specs(product_id, name, version)
  select id, 'Shipment Test Spec', 'v1' from product
  returning id
), po as (
  insert into public.purchase_orders(
    customer_id, customer_po_number, po_date, product_id, product_spec_id,
    shipment_configuration_id, contract_quantity_mt, incoterm, destination,
    currency, final_selling_price, created_by, shipment_mt_per_container
  )
  select customer.id, 'SHIPMENT-TEST-PO', current_date, product.id, spec.id,
    configuration.id, 1, 'FOB', 'Test destination', 'USD', 100, profile.id, 500
  from customer
  cross join product
  cross join spec
  cross join profile
  cross join lateral (
    select id from public.shipment_configurations
    where shipment_mode = 'Bulk Vessel' and is_active
  ) configuration
  returning shipment_mt_per_container
)
select shipment_mt_per_container from po;
select is(
  (select shipment_mt_per_container from shipment_test_result),
  500.000::numeric,
  'Bulk Vessel PO preserves manual MT / Shipment'
);

select * from finish();
rollback;
