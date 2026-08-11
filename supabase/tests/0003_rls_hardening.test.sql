begin;
select plan(2);
select is((select relrowsecurity from pg_class where oid = 'public.customer_ownership_history'::regclass), true, 'ownership history has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.product_shipment_configurations'::regclass), true, 'product configuration mapping has RLS');
select * from finish();
rollback;
