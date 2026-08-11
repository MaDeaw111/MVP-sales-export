begin;
select plan(1);
select has_function('public', 'approve_po_fx', 'Manager FX approval function exists');
select * from finish();
rollback;
