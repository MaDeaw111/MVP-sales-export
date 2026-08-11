begin;
select plan(5);

select ok(to_regclass('public.jumbobag_master') is not null, 'Jumbobag master exists');
select is((select count(*)::int from public.jumbobag_master where is_active), 3, 'three active Jumbobag weights are seeded');
select ok(exists(select 1 from pg_trigger where tgname = 'sync_shipment_configuration'), 'configuration calculation trigger exists');
select ok(exists(select 1 from pg_trigger where tgname = 'snapshot_po_shipment_load'), 'PO shipment snapshot trigger exists');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'jumbobag_master' and policyname = 'admins manage jumbobags'), 'Admin master-data policy exists');

select * from finish();
rollback;
