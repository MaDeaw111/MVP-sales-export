begin;
select plan(2);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'customer_code'
  ),
  'customers have a customer_code column'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.customers'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (customer_code)'
  ),
  'customer codes are unique'
);

select * from finish();
rollback;
