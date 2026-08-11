
create or replace function public.approve_po_fx(p_po_id uuid, p_fx_rate numeric, p_bank_name text, p_rate_date date)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_app_role('MANAGEMENT') or public.has_app_role('ADMIN')) then
    raise exception 'Manager approval is required for PO FX';
  end if;
  if p_fx_rate <= 0 or p_bank_name is null or trim(p_bank_name) = '' or p_rate_date is null then
    raise exception 'FX rate, bank name, and rate date are required';
  end if;
  update public.purchase_orders
    set fx_rate = p_fx_rate, fx_bank_name = trim(p_bank_name), fx_rate_date = p_rate_date,
        fx_approved_by = public.current_profile_id(), fx_approved_at = now(), updated_at = now()
    where id = p_po_id and currency in ('EUR', 'THB');
  if not found then raise exception 'EUR or THB PO not found'; end if;
  return p_po_id;
end;
$$;
grant execute on function public.approve_po_fx(uuid,numeric,text,date) to authenticated;
