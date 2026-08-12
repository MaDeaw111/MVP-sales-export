begin;
select plan(9);

select ok(to_regclass('public.jumbobag_master') is not null, 'Jumbobag master exists');
select is((select count(*)::int from public.jumbobag_master where is_active), 3, 'three active Jumbobag weights are seeded');
select ok(exists(select 1 from pg_trigger where tgname = 'sync_shipment_configuration'), 'configuration calculation trigger exists');
select ok(exists(select 1 from pg_trigger where tgname = 'snapshot_po_shipment_load'), 'PO shipment snapshot trigger exists');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'jumbobag_master' and policyname = 'admins manage jumbobags'), 'Admin master-data policy exists');
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
  1,
  'only the standard 20 MT Bulk Container configuration remains active'
);

select * from finish();
rollback;
