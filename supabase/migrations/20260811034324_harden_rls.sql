
alter table public.customer_ownership_history enable row level security;
alter table public.product_shipment_configurations enable row level security;

create policy "ownership history access" on public.customer_ownership_history
  for select to authenticated
  using (public.can_access_customer(customer_id));

create policy "internal inserts ownership history" on public.customer_ownership_history
  for insert to authenticated
  with check (public.is_internal_user());

create policy "product configuration read" on public.product_shipment_configurations
  for select to authenticated
  using (public.is_active_profile());

create policy "product configuration manage" on public.product_shipment_configurations
  for all to authenticated
  using (public.is_internal_user())
  with check (public.is_internal_user());
