begin;
select plan(4);

select ok(
  not has_function_privilege('anon', 'public.complete_google_login()', 'execute'),
  'anon cannot execute approved-profile login RPC'
);
select ok(
  not has_function_privilege('anon', 'public.approve_po_fx(uuid,numeric,text,date)', 'execute'),
  'anon cannot execute FX approval RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.complete_google_login()', 'execute'),
  'authenticated users can execute approved-profile login RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.can_access_customer(uuid)', 'execute'),
  'authenticated users can evaluate customer access in RLS policies'
);

select * from finish();
rollback;
