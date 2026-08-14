create or replace function public.activate_customer_after_po_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers
  set status = 'ACTIVE_CUSTOMER'
  where id = new.customer_id
    and status is distinct from 'ACTIVE_CUSTOMER'::public.customer_status;
  return new;
end;
$$;

revoke execute on function public.activate_customer_after_po_insert()
from public, anon, authenticated;
