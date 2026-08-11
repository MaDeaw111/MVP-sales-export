begin;
select plan(1);
select ok(exists(select 1 from pg_trigger where tgrelid='public.document_versions'::regclass and tgname='retain_po_document_versions'), 'document version retention trigger exists');
select * from finish();
rollback;
