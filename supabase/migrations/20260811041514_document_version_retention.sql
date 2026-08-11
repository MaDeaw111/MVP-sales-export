
create or replace function public.retain_po_document_versions()
returns trigger language plpgsql security definer set search_path = public, storage as $$
begin
  update public.documents set current_version_id = new.id where id = new.document_id;
  delete from storage.objects where bucket_id = 'customer-po-private' and name in (
    select object_path from public.document_versions where document_id = new.document_id order by version_number desc offset 2
  );
  delete from public.document_versions where id in (
    select id from public.document_versions where document_id = new.document_id order by version_number desc offset 2
  );
  return new;
end;
$$;
create trigger retain_po_document_versions after insert on public.document_versions
for each row execute function public.retain_po_document_versions();
