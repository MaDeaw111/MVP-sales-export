begin;
select plan(12);

select ok(
  (select prosecdef
    from pg_proc
    where oid = 'public.activate_customer_after_po_insert()'::regprocedure),
  'customer activation trigger function runs with its owner privileges'
);
select is(
  (select proconfig
    from pg_proc
    where oid = 'public.activate_customer_after_po_insert()'::regprocedure),
  array['search_path=public']::text[],
  'customer activation trigger function fixes its search path to public'
);
select ok(
  not has_function_privilege('anon', 'public.activate_customer_after_po_insert()', 'execute'),
  'anon cannot execute the customer activation trigger function directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.activate_customer_after_po_insert()', 'execute'),
  'authenticated users cannot execute the customer activation trigger function directly'
);

create temp table customer_po_activation_fixture on commit drop as
with auth_identity as (
  insert into auth.users(id, email, created_at, updated_at)
  values (gen_random_uuid(), 'customer-po-activation-auth@example.com', now(), now())
  returning id
), profile as (
  insert into public.user_profiles(email, auth_user_id, role)
  select 'customer-po-activation@example.com', id, 'INTERNAL'
  from auth_identity
  returning id, auth_user_id
), valid_customer as (
  insert into public.customers(name, source, status)
  values ('Customer PO Activation Valid', 'DIRECT_WCAT', 'PROSPECT')
  returning id
), invalid_customer as (
  insert into public.customers(name, source, status)
  values ('Customer PO Activation Invalid', 'DIRECT_WCAT', 'PROSPECT')
  returning id
), product as (
  insert into public.products(code, name, is_active)
  values ('PO-ACTIVATION', 'Customer PO Activation Product', true)
  returning id
), approved_spec as (
  insert into public.product_specs(product_id, name, version, status)
  select id, 'Customer PO Activation Approved Spec', 'approved', 'APPROVED'
  from product
  returning id
), draft_spec as (
  insert into public.product_specs(product_id, name, version, status)
  select id, 'Customer PO Activation Draft Spec', 'draft', 'DRAFT'
  from product
  returning id
)
select
  profile.id as profile_id,
  profile.auth_user_id,
  valid_customer.id as valid_customer_id,
  invalid_customer.id as invalid_customer_id,
  product.id as product_id,
  approved_spec.id as approved_spec_id,
  draft_spec.id as draft_spec_id
from profile
cross join valid_customer
cross join invalid_customer
cross join product
cross join approved_spec
cross join draft_spec;

grant select on customer_po_activation_fixture to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select auth_user_id::text from customer_po_activation_fixture),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$insert into public.purchase_orders(
      customer_id, customer_po_number, po_date, product_id, product_spec_id,
      contract_quantity_mt, incoterm, destination, currency, final_selling_price
    )
    select valid_customer_id, 'PO-ACTIVATION-VALID', current_date,
      product_id, approved_spec_id, 1, 'FOB', 'Activation destination',
      'USD', 100
    from customer_po_activation_fixture$$,
  'a valid PO can be inserted for a Prospect customer'
);
select is(
  (select count(*)
    from public.purchase_orders
    where customer_po_number = 'PO-ACTIVATION-VALID'),
  1::bigint,
  'the authenticated INTERNAL user inserts the PO through normal RLS'
);
select is(
  (select created_by
    from public.purchase_orders
    where customer_po_number = 'PO-ACTIVATION-VALID'),
  (select profile_id from customer_po_activation_fixture),
  'the PO records the authenticated INTERNAL profile as its creator'
);
select is(
  (select status
    from public.customers
    where id = (select valid_customer_id from customer_po_activation_fixture)),
  'ACTIVE_CUSTOMER'::public.customer_status,
  'a successful PO insert activates its Prospect customer'
);

reset role;

select throws_ok(
  $$insert into public.purchase_orders(
      customer_id, customer_po_number, po_date, product_id, product_spec_id,
      contract_quantity_mt, incoterm, destination, currency, final_selling_price,
      created_by
    )
    select invalid_customer_id, 'PO-ACTIVATION-INVALID', current_date,
      product_id, draft_spec_id, 1, 'FOB', 'Rejected activation destination',
      'USD', 100, profile_id
    from customer_po_activation_fixture$$,
  'P0001',
  'Product must be active and Product Spec must be APPROVED for that Product',
  'an invalid PO insert is rejected'
);
select is(
  (select status
    from public.customers
    where id = (select invalid_customer_id from customer_po_activation_fixture)),
  'PROSPECT'::public.customer_status,
  'a rejected PO insert leaves its Prospect customer unchanged'
);

update public.customers
set status = 'PROSPECT'
where id = (select valid_customer_id from customer_po_activation_fixture);

select lives_ok(
  $$update public.purchase_orders
    set final_selling_price = 125
    where customer_id = (
      select valid_customer_id from customer_po_activation_fixture
    )$$,
  'commercial data on a valid PO can be updated'
);
select is(
  (select status
    from public.customers
    where id = (select valid_customer_id from customer_po_activation_fixture)),
  'PROSPECT'::public.customer_status,
  'updating PO commercial data does not modify customer status'
);

select * from finish();
rollback;
