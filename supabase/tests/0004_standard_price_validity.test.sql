begin;
select plan(1);
select ok(exists(select 1 from pg_trigger where tgrelid='public.standard_fob_prices'::regclass and tgname='set_standard_price_valid_until'), 'standard price validity trigger exists');
select * from finish();
rollback;
