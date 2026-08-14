create or replace function public.activate_customer_after_po_insert()
returns trigger
language plpgsql
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

drop trigger if exists activate_customer_after_po_insert on public.purchase_orders;
create trigger activate_customer_after_po_insert
after insert on public.purchase_orders
for each row execute function public.activate_customer_after_po_insert();
