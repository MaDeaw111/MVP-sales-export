begin;
select plan(1);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'special_price_requests'
      and policyname = 'special price access'
  ),
  'special price requests have customer-derived access policy'
);

select * from finish();
rollback;
