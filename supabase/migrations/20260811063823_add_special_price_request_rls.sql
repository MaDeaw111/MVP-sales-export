create policy "special price access" on public.special_price_requests
for all to authenticated
using (public.can_access_customer(customer_id))
with check (public.can_access_customer(customer_id));
