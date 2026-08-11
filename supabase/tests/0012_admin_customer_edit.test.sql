begin;
select plan(3);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'admins update customers'
  ),
  'admins have a dedicated customer update policy'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'validate_customer_source_owner'),
  'customer source and owner validation trigger exists'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'record_customer_owner_change'),
  'customer ownership changes are audited'
);

select * from finish();
rollback;
