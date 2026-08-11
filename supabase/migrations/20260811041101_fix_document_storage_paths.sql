
drop policy "PO objects readable" on storage.objects;
drop policy "PO objects uploadable" on storage.objects;

create policy "PO objects readable" on storage.objects for select to authenticated
using (bucket_id='customer-po-private' and exists (
  select 1 from public.documents d join public.purchase_orders p on p.id=d.po_id
  where (storage.foldername(name))[4]=d.id::text and public.can_access_customer(p.customer_id)
));

create policy "PO objects uploadable" on storage.objects for insert to authenticated
with check (bucket_id='customer-po-private' and exists (
  select 1 from public.purchase_orders p
  where (storage.foldername(name))[3]=p.id::text and public.can_access_customer(p.customer_id)
));
