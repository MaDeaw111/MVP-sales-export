begin;
select plan(41);

select ok(to_regclass('public.jumbobag_master') is not null, 'Jumbobag master exists');
select is((select count(*)::int from public.jumbobag_master where is_active), 3, 'three active Jumbobag weights are seeded');
select ok(exists(select 1 from pg_trigger where tgname = 'sync_shipment_configuration'), 'configuration calculation trigger exists');
select ok(exists(select 1 from pg_trigger where tgname = 'snapshot_po_shipment_load'), 'PO shipment snapshot trigger exists');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'jumbobag_master' and policyname = 'admins manage jumbobags'), 'Admin master-data policy exists');
select is(
  (select count(*)::integer from public.shipment_configurations
    where shipment_mode = 'Container' and container_type = '20'
      and package = 'Bulk Container + Liner'
      and package_type = 'BULK_CONTAINER'
      and standard_mt_per_container = 20.000::numeric
      and tolerance_percent = 5.000::numeric
      and is_active),
  1,
  'one active canonical Bulk Container + Liner configuration exists'
);
select ok(
  not exists(
    select 1
    from public.shipment_configurations
    where shipment_mode = 'Container'
      and trim(container_type) = '20'''
  ),
  '20-foot configurations use only the canonical stored key'
);
select is(
  (select count(*)::integer
    from public.shipment_configurations
    where shipment_mode = 'Container'
      and container_type = '20'
      and package = 'Bag 25 kg'
      and package_type = 'BAG_25KG'
      and is_active),
  1,
  'one active canonical Bag 25 kg configuration exists'
);
select is(
  (select bag_weight_kg
    from public.shipment_configurations
    where shipment_mode = 'Container'
      and container_type = '20'
      and package_type = 'BAG_25KG'
      and is_active),
  25.000::numeric,
  'canonical Bag 25 kg configuration has a 25 kg bag weight'
);
select ok(
  (select bags_per_container is null
    from public.shipment_configurations
    where shipment_mode = 'Container'
      and container_type = '20'
      and package_type = 'BAG_25KG'
      and is_active),
  'canonical Bag 25 kg configuration leaves the PO bag count manual'
);
select ok(
  (select standard_mt_per_container is null
    from public.shipment_configurations
    where shipment_mode = 'Container'
      and container_type = '20'
      and package_type = 'BAG_25KG'
      and is_active),
  'canonical Bag 25 kg configuration leaves MT to the PO calculation'
);
select is(
  (select tolerance_percent
    from public.shipment_configurations
    where shipment_mode = 'Container'
      and container_type = '20'
      and package_type = 'BAG_25KG'
      and is_active),
  0.000::numeric,
  'canonical Bag 25 kg configuration has zero tolerance'
);
select lives_ok(
  $test$
    do $block$
    begin
      insert into public.shipment_configurations(
        shipment_mode, container_type, package, package_type,
        standard_mt_per_container, tolerance_percent, is_active, remark
      ) values
        ('Container', '20', 'Bulk Container + Liner', 'LEGACY', 0, 0, false, 'inactive legacy Liner'),
        ('Container', '40''', 'bulk container + liner', 'BULK_CONTAINER', 18, 2, true, 'alternate active Liner');
      perform public.reconcile_liner_shipment_configurations();
    end;
    $block$;
  $test$,
  'reconciles existing Liner configurations to the canonical rule'
);
select is(
  (select count(*)::integer from public.shipment_configurations
    where lower(trim(package)) = 'bulk container + liner' and is_active),
  1,
  'only the canonical Liner configuration remains active after reconciliation'
);
select throws_ok(
  $$insert into public.shipment_configurations(
      shipment_mode, container_type, package, package_type,
      standard_mt_per_container, tolerance_percent, is_active
    ) values ('Container', '20', 'Bulk Container + Liner', 'BULK_CONTAINER', 20, 5, true)$$,
  '23505',
  'duplicate key value violates unique constraint "shipment_configurations_one_active_bulk_liner_20_idx"',
  'rejects a second active canonical Liner configuration'
);
select lives_ok(
  $test$
    do $block$
    begin
      insert into public.shipment_configurations(
        shipment_mode, container_type, package, package_type,
        standard_mt_per_container, tolerance_percent, is_active, remark
      ) values (
        'Container', '20', '25 kg Bag', 'BAG_25KG',
        null, 9, false, 'inactive legacy Bag 25 kg variant'
      );
      perform public.reconcile_bag_25kg_shipment_configurations();
      perform public.reconcile_bag_25kg_shipment_configurations();
    end;
    $block$;
  $test$,
  'reconciles Bag 25 kg variants idempotently'
);
select is(
  (select count(*)::integer
    from public.shipment_configurations
    where shipment_mode = 'Container'
      and container_type = '20'
      and package_type = 'BAG_25KG'
      and is_active),
  1,
  'Bag 25 kg reconciliation keeps exactly one active configuration'
);
select is(
  (select count(*)::integer
    from public.shipment_configurations
    where shipment_mode = 'Container'
      and container_type = '20'
      and package_type = 'BAG_25KG'),
  2,
  'repeated Bag 25 kg reconciliation does not accumulate rows'
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

create temp table shipment_po_fixture on commit drop as
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
  insert into public.product_specs(product_id, name, version, status)
  select id, 'Shipment Test Spec', 'v1', 'APPROVED' from product
  returning id
)
select profile.id as profile_id, customer.id as customer_id, product.id as product_id, spec.id as spec_id
from profile
cross join customer
cross join product
cross join spec;

insert into public.shipment_configurations(
  shipment_mode, container_type, package, package_type,
  standard_mt_per_container, tolerance_percent, is_active
) values
  ('Bulk Vessel', 'N/A', 'Bulk Vessel', 'LEGACY', 0, 3, true),
  ('Truck', 'N/A', 'Truck', 'LEGACY', 0, 4, true),
  ('Bulk Vessel', 'N/A', 'Inactive Bulk Vessel', 'LEGACY', 0, 0, false);

create temp table vessel_po_result on commit drop as
with po as (
  insert into public.purchase_orders(
    customer_id, customer_po_number, po_date, product_id, product_spec_id,
    shipment_configuration_id, contract_quantity_mt, incoterm, destination,
    currency, final_selling_price, created_by, shipment_mt_per_container
  )
  select fixture.customer_id, 'SHIPMENT-TEST-VESSEL', current_date, fixture.product_id, fixture.spec_id,
    configuration.id, 1, 'FOB', 'Test destination', 'USD', 100, fixture.profile_id, 500
  from shipment_po_fixture fixture
  cross join lateral (
    select id from public.shipment_configurations
    where shipment_mode = 'Bulk Vessel' and package = 'Bulk Vessel' and is_active
  ) configuration
  returning shipment_mt_per_container
)
select shipment_mt_per_container from po;
select is(
  (select shipment_mt_per_container from vessel_po_result),
  500.000::numeric,
  'Bulk Vessel PO preserves manual MT / Shipment'
);

create temp table truck_po_result on commit drop as
with po as (
  insert into public.purchase_orders(
    customer_id, customer_po_number, po_date, product_id, product_spec_id,
    shipment_configuration_id, contract_quantity_mt, incoterm, destination,
    currency, final_selling_price, created_by, shipment_bags_per_container, shipment_mt_per_container
  )
  select fixture.customer_id, 'SHIPMENT-TEST-TRUCK', current_date, fixture.product_id, fixture.spec_id,
    configuration.id, 1, 'FOB', 'Test destination', 'USD', 100, fixture.profile_id, 12, 500
  from shipment_po_fixture fixture
  cross join lateral (
    select id from public.shipment_configurations
    where shipment_mode = 'Truck' and is_active
  ) configuration
  returning shipment_bags_per_container, shipment_mt_per_container, shipment_tolerance_percent
)
select shipment_bags_per_container, shipment_mt_per_container, shipment_tolerance_percent from po;
select is(
  (select shipment_mt_per_container from truck_po_result),
  500.000::numeric,
  'Truck PO preserves manual MT / Shipment'
);
select ok(
  (select shipment_bags_per_container is null from truck_po_result),
  'Truck PO clears container bag count'
);
select is(
  (select shipment_tolerance_percent from truck_po_result),
  4.000::numeric,
  'Truck PO snapshots configuration tolerance'
);
select throws_ok(
  $$insert into public.purchase_orders(
      customer_id, customer_po_number, po_date, product_id, product_spec_id,
      shipment_configuration_id, contract_quantity_mt, incoterm, destination,
      currency, final_selling_price, created_by, shipment_mt_per_container
    )
    select fixture.customer_id, 'SHIPMENT-TEST-VESSEL-ZERO', current_date, fixture.product_id, fixture.spec_id,
      configuration.id, 1, 'FOB', 'Test destination', 'USD', 100, fixture.profile_id, 0
    from shipment_po_fixture fixture
    cross join lateral (
      select id from public.shipment_configurations
      where shipment_mode = 'Bulk Vessel' and package = 'Bulk Vessel' and is_active
    ) configuration$$,
  'P0001',
  'Bulk Vessel configuration requires a positive MT / Shipment value',
  'Bulk Vessel requires positive manual MT / Shipment'
);
select throws_ok(
  $$insert into public.purchase_orders(
      customer_id, customer_po_number, po_date, product_id, product_spec_id,
      shipment_configuration_id, contract_quantity_mt, incoterm, destination,
      currency, final_selling_price, created_by, shipment_mt_per_container
    )
    select fixture.customer_id, 'SHIPMENT-TEST-INACTIVE', current_date, fixture.product_id, fixture.spec_id,
      configuration.id, 1, 'FOB', 'Test destination', 'USD', 100, fixture.profile_id, 500
    from shipment_po_fixture fixture
    cross join lateral (
      select id from public.shipment_configurations
      where package = 'Inactive Bulk Vessel'
    ) configuration$$,
  'P0001',
  'Shipment Configuration must be active',
  'inactive shipment configuration is rejected'
);
select throws_ok(
  $$insert into public.purchase_orders(
      customer_id, customer_po_number, po_date, product_id, product_spec_id,
      shipment_configuration_id, contract_quantity_mt, incoterm, destination,
      currency, final_selling_price, created_by, shipment_bags_per_container
    )
    select fixture.customer_id, 'SHIPMENT-TEST-BAG-ZERO', current_date, fixture.product_id, fixture.spec_id,
      configuration.id, 1, 'FOB', 'Test destination', 'USD', 100, fixture.profile_id, 0
    from shipment_po_fixture fixture
    cross join lateral (
      select id from public.shipment_configurations
      where shipment_mode = 'Container'
        and container_type = '20'
        and package_type = 'BAG_25KG'
        and is_active
    ) configuration$$,
  'P0001',
  '25 kg bag configuration requires a positive whole-number bag count',
  '25 kg bag configuration rejects a non-positive bag count'
);
create temp table bag_po_result on commit drop as
with po as (
  insert into public.purchase_orders(
    customer_id, customer_po_number, po_date, product_id, product_spec_id,
    shipment_configuration_id, contract_quantity_mt, incoterm, destination,
    currency, final_selling_price, created_by, shipment_bags_per_container
  )
  select fixture.customer_id, 'SHIPMENT-TEST-BAG', current_date, fixture.product_id, fixture.spec_id,
    configuration.id, 1, 'FOB', 'Test destination', 'USD', 100, fixture.profile_id, 40
  from shipment_po_fixture fixture
  cross join lateral (
    select id from public.shipment_configurations
    where shipment_mode = 'Container'
      and container_type = '20'
      and package_type = 'BAG_25KG'
      and is_active
  ) configuration
  returning shipment_bags_per_container, shipment_mt_per_container, shipment_tolerance_percent
)
select shipment_bags_per_container, shipment_mt_per_container, shipment_tolerance_percent from po;
select is(
  (select shipment_bags_per_container from bag_po_result),
  40,
  '25 kg bag PO snapshots the manual whole-bag count'
);
select is(
  (select shipment_mt_per_container from bag_po_result),
  1.000::numeric,
  '25 kg bag PO calculates manual bag count as MT / Shipment'
);
select is(
  (select shipment_tolerance_percent from bag_po_result),
  0.000::numeric,
  '25 kg bag PO snapshots configuration tolerance'
);
select lives_ok(
  $$update public.purchase_orders
    set shipment_bags_per_container = 80
    where customer_po_number = 'SHIPMENT-TEST-BAG'$$,
  '25 kg bag PO accepts an intentional bag-count change'
);
select is(
  (select shipment_bags_per_container
    from public.purchase_orders
    where customer_po_number = 'SHIPMENT-TEST-BAG'),
  80,
  'intentional Bag 25 kg input changes replace the snapshotted bag count'
);
select is(
  (select shipment_mt_per_container
    from public.purchase_orders
    where customer_po_number = 'SHIPMENT-TEST-BAG'),
  2.000::numeric,
  'intentional Bag 25 kg input changes recalculate MT'
);
select is(
  (select shipment_tolerance_percent
    from public.purchase_orders
    where customer_po_number = 'SHIPMENT-TEST-BAG'),
  0.000::numeric,
  'intentional Bag 25 kg input changes retain configuration tolerance'
);
update public.shipment_configurations
set is_active = false
where shipment_mode = 'Container'
  and container_type = '20'
  and package_type = 'BAG_25KG'
  and is_active;
select lives_ok(
  $$update public.purchase_orders
    set shipment_mt_per_container = 999,
        shipment_tolerance_percent = 9
    where customer_po_number = 'SHIPMENT-TEST-BAG'$$,
  'Bag 25 kg derived-output tampering is ignored after configuration deactivation'
);
select is(
  (select jsonb_build_object(
      'bags', shipment_bags_per_container,
      'mt', shipment_mt_per_container,
      'tolerance', shipment_tolerance_percent
    )
    from public.purchase_orders
    where customer_po_number = 'SHIPMENT-TEST-BAG'),
  '{"bags": 80, "mt": 2.000, "tolerance": 0.000}'::jsonb,
  'Bag 25 kg derived-output tampering preserves the immutable snapshot'
);

create temp table fixed_jumbobag_po_result on commit drop as
with po as (
  insert into public.purchase_orders(
    customer_id, customer_po_number, po_date, product_id, product_spec_id,
    shipment_configuration_id, contract_quantity_mt, incoterm, destination,
    currency, final_selling_price, created_by
  )
  select fixture.customer_id, 'SHIPMENT-TEST-JUMBOBAG', current_date, fixture.product_id, fixture.spec_id,
    configuration.id, 1, 'FOB', 'Test destination', 'USD', 100, fixture.profile_id
  from shipment_po_fixture fixture
  cross join lateral (
    select configuration.id
    from public.shipment_configurations configuration
    join public.jumbobag_master jumbobag on jumbobag.id = configuration.jumbobag_id
    where configuration.package_type = 'JUMBOBAG'
      and configuration.container_type = '20'
      and jumbobag.weight_kg = 850
      and configuration.bags_per_container = 20
      and configuration.is_active
  ) configuration
  returning shipment_bags_per_container, shipment_mt_per_container, shipment_tolerance_percent
)
select shipment_bags_per_container, shipment_mt_per_container, shipment_tolerance_percent from po;
select is(
  (select shipment_bags_per_container from fixed_jumbobag_po_result),
  20,
  'fixed Jumbobag PO snapshots configured bags per container'
);
select is(
  (select shipment_mt_per_container from fixed_jumbobag_po_result),
  17.000::numeric,
  'fixed Jumbobag PO snapshots configured MT per container'
);
select is(
  (select shipment_tolerance_percent from fixed_jumbobag_po_result),
  0.000::numeric,
  'fixed Jumbobag PO snapshots configured tolerance'
);

select * from finish();
rollback;
