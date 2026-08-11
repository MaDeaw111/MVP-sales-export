create or replace function public.create_external_customer_first_po(p_customer jsonb, p_po jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_profile uuid := public.current_profile_id(); v_customer uuid; v_po uuid;
begin
 if not public.has_app_role('EXTERNAL_SALES') then raise exception 'Only External Sales can use First PO registration'; end if;
 insert into public.customers(name,source,owner_profile_id,status) values (trim(p_customer->>'name'),'EXTERNAL_SALES',v_profile,'ACTIVE_CUSTOMER') returning id into v_customer;
 insert into public.purchase_orders(customer_id,customer_po_number,po_date,product_id,product_spec_id,product_spec_snapshot,shipment_configuration_id,contract_quantity_mt,incoterm,destination,payment_term,currency,final_selling_price,commission_usd_mt,freight_snapshot_usd_mt,fx_rate,fx_bank_name,fx_rate_date)
 values (v_customer,p_po->>'customer_po_number',(p_po->>'po_date')::date,(p_po->>'product_id')::uuid,(p_po->>'product_spec_id')::uuid,coalesce(p_po->'product_spec_snapshot','{}'::jsonb),nullif(p_po->>'shipment_configuration_id','')::uuid,(p_po->>'contract_quantity_mt')::numeric,(p_po->>'incoterm')::public.incoterm,p_po->>'destination',p_po->>'payment_term',(p_po->>'currency')::public.po_currency,(p_po->>'final_selling_price')::numeric,coalesce((p_po->>'commission_usd_mt')::numeric,0),nullif(p_po->>'freight_snapshot_usd_mt','')::numeric,nullif(p_po->>'fx_rate','')::numeric,p_po->>'fx_bank_name',nullif(p_po->>'fx_rate_date','')::date)
 returning id into v_po;
 update public.customers set first_po_id=v_po where id=v_customer;
 insert into public.customer_ownership_history(customer_id,new_owner_profile_id,reason,changed_by) values(v_customer,v_profile,'First PO registration',v_profile);
 perform public.evaluate_po_commercial(v_po); return v_po;
end; $$;

create or replace function public.evaluate_po_commercial(p_po_id uuid)
returns table(decision public.commercial_decision, standard_fob_usd_mt numeric, fob_equivalent_usd_mt numeric, reason text)
language plpgsql security definer set search_path = public as $$
declare p public.purchase_orders; s public.standard_fob_prices; v_selling_usd numeric; v_equiv numeric; v_decision public.commercial_decision; v_reason text;
begin
 select * into p from public.purchase_orders where id=p_po_id for update; if not found then raise exception 'PO not found'; end if;
 if p.currency <> 'USD' and (p.fx_rate is null or p.fx_approved_at is null) then v_decision:='PENDING_APPROVAL'; v_reason:='Manager-approved FX is required'; v_equiv:=null;
 else v_selling_usd:=case when p.currency='USD' then p.final_selling_price else p.final_selling_price / p.fx_rate end; v_equiv:=v_selling_usd-p.commission_usd_mt-coalesce(p.freight_snapshot_usd_mt,0); select * into s from public.get_active_standard_fob(p.product_id,p.product_spec_id,p.po_date);
   if s.id is null then v_decision:='NO_ACTIVE_STANDARD'; v_reason:='No Active Standard Price';
   elsif v_equiv >= s.fob_usd_mt then v_decision:='AUTO_PASS'; v_reason:='FOB Equivalent meets Active Standard FOB';
   else v_decision:='PENDING_APPROVAL'; v_reason:='FOB Equivalent is below Active Standard FOB'; end if;
 end if;
 update public.purchase_orders set fob_base_snapshot_usd_mt=s.fob_usd_mt, commercial_decision=v_decision, commercial_reason=v_reason, updated_at=now() where id=p_po_id;
 return query select v_decision,s.fob_usd_mt,v_equiv,v_reason;
end; $$;

create or replace function public.approve_special_price_request(p_request_id uuid,p_approved_fob_usd_mt numeric,p_valid_until date,p_note text) returns uuid
language plpgsql security definer set search_path=public as $$ begin
 if not (public.has_app_role('MANAGEMENT') or public.has_app_role('ADMIN')) then raise exception 'Manager approval is required'; end if;
 update public.special_price_requests set approved_fob_usd_mt=p_approved_fob_usd_mt,valid_until=p_valid_until,status='APPROVED',approved_by=public.current_profile_id(),approved_at=now(),note=p_note where id=p_request_id and status='PENDING';
 if not found then raise exception 'Special Price Request is not pending'; end if; return p_request_id; end; $$;

create or replace function public.link_approved_special_price_to_po(p_special_price_id uuid,p_po_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare s public.special_price_requests; p public.purchase_orders;
begin select * into s from public.special_price_requests where id=p_special_price_id for update; select * into p from public.purchase_orders where id=p_po_id for update;
 if s.status<>'APPROVED' or s.valid_until<current_date then raise exception 'Special Price Approval is not active'; end if;
 if s.product_id<>p.product_id or s.product_spec_id<>p.product_spec_id or s.customer_id<>p.customer_id then raise exception 'Special Price Approval does not match this PO'; end if;
 update public.special_price_requests set status='USED_IN_PO',linked_po_id=p_po_id where id=s.id; update public.purchase_orders set commercial_decision='APPROVED_SPECIAL',commercial_reason='Approved pre-PO Special Price',fob_base_snapshot_usd_mt=s.approved_fob_usd_mt where id=p_po_id;
end; $$;

create or replace function public.approve_direct_po_as_special(p_po_id uuid,p_valid_until date,p_note text) returns uuid
language plpgsql security definer set search_path=public as $$
declare p public.purchase_orders; v_id uuid;
begin if not (public.has_app_role('MANAGEMENT') or public.has_app_role('ADMIN')) then raise exception 'Manager approval is required'; end if;
 select * into p from public.purchase_orders where id=p_po_id for update; if p.commercial_decision not in ('PENDING_APPROVAL','NO_ACTIVE_STANDARD') then raise exception 'PO is not pending commercial approval'; end if;
 insert into public.special_price_requests(customer_id,product_id,product_spec_id,requested_fob_usd_mt,approved_fob_usd_mt,standard_fob_snapshot,status,valid_until,linked_po_id,reason,requested_by,approved_by,approved_at,note)
 values(p.customer_id,p.product_id,p.product_spec_id,p.final_selling_price,p.final_selling_price,p.fob_base_snapshot_usd_mt,'USED_IN_PO',p_valid_until,p.id,'Direct PO commercial approval',p.created_by,public.current_profile_id(),now(),p_note) returning id into v_id;
 update public.purchase_orders set commercial_decision='APPROVED_SPECIAL',commercial_reason='Manager approved Direct PO Special Price',updated_at=now() where id=p.id; return v_id; end; $$;

create table public.documents (id uuid primary key default gen_random_uuid(), po_id uuid not null references public.purchase_orders(id) on delete cascade, document_type text not null default 'CUSTOMER_PO', current_version_id uuid, created_at timestamptz not null default now());
create table public.document_versions (id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete cascade, version_number integer not null, object_path text not null unique, original_filename text not null, mime_type text, byte_size bigint, uploaded_by uuid not null default public.current_profile_id(), created_at timestamptz not null default now(), unique(document_id,version_number));
alter table public.documents add constraint documents_current_version_fk foreign key(current_version_id) references public.document_versions(id) deferrable initially deferred;
insert into storage.buckets(id,name,public) values('customer-po-private','customer-po-private',false) on conflict(id) do update set public=false;
alter table public.documents enable row level security; alter table public.document_versions enable row level security;
create policy "document metadata access" on public.documents for all to authenticated using(exists(select 1 from public.purchase_orders p where p.id=po_id and public.can_access_customer(p.customer_id))) with check(exists(select 1 from public.purchase_orders p where p.id=po_id and public.can_access_customer(p.customer_id)));
create policy "document version access" on public.document_versions for all to authenticated using(exists(select 1 from public.documents d join public.purchase_orders p on p.id=d.po_id where d.id=document_id and public.can_access_customer(p.customer_id))) with check(exists(select 1 from public.documents d join public.purchase_orders p on p.id=d.po_id where d.id=document_id and public.can_access_customer(p.customer_id)));
create policy "PO objects readable" on storage.objects for select to authenticated using(bucket_id='customer-po-private' and exists(select 1 from public.documents d join public.purchase_orders p on p.id=d.po_id where (storage.foldername(name))[3]=d.id::text and public.can_access_customer(p.customer_id)));
create policy "PO objects uploadable" on storage.objects for insert to authenticated with check(bucket_id='customer-po-private' and exists(select 1 from public.purchase_orders p where (storage.foldername(name))[2]=p.id::text and public.can_access_customer(p.customer_id)));
grant execute on function public.create_external_customer_first_po(jsonb,jsonb),public.evaluate_po_commercial(uuid),public.approve_special_price_request(uuid,numeric,date,text),public.link_approved_special_price_to_po(uuid,uuid),public.approve_direct_po_as_special(uuid,date,text) to authenticated;
