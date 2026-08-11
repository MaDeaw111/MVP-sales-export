begin;
select plan(1);
select ok((select with_check from pg_policies where schemaname='storage' and tablename='objects' and policyname='PO objects uploadable') like '%[3]%', 'upload policy validates the PO folder segment');
select * from finish();
rollback;
