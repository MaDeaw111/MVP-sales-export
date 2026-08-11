begin;
select plan(2);
select ok(has_table_privilege('authenticated', 'public.customers', 'select'), 'authenticated can reach customers through Data API');
select ok(has_table_privilege('authenticated', 'public.purchase_orders', 'insert'), 'authenticated can create permitted POs through Data API');
select * from finish();
rollback;
