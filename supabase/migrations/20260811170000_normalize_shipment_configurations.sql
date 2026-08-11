create table public.jumbobag_master (
  id uuid primary key default gen_random_uuid(),
  weight_kg numeric(10,3) not null unique check (weight_kg > 0),
  is_active boolean not null default true,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.jumbobag_master(weight_kg, remark) values
  (850, 'Initial standard Jumbobag'), (950, 'Initial standard Jumbobag'), (1200, 'Initial standard Jumbobag')
on conflict (weight_kg) do nothing;

alter table public.jumbobag_master enable row level security;
create policy "jumbobag master read" on public.jumbobag_master for select to authenticated using (public.is_active_profile());
create policy "admins manage jumbobags" on public.jumbobag_master for all to authenticated using (public.has_app_role('ADMIN')) with check (public.has_app_role('ADMIN'));
grant select, insert, update, delete on public.jumbobag_master to authenticated;

alter table public.shipment_configurations add column package_type text not null default 'LEGACY' check (package_type in ('JUMBOBAG','BAG_25KG','BULK_CONTAINER','LEGACY'));
alter table public.shipment_configurations add column jumbobag_id uuid references public.jumbobag_master(id);
alter table public.shipment_configurations alter column standard_mt_per_container drop not null;
alter table public.purchase_orders add column shipment_bags_per_container integer;
alter table public.purchase_orders add column shipment_mt_per_container numeric(14,3);
alter table public.purchase_orders add column shipment_tolerance_percent numeric(8,3);

create or replace function public.sync_shipment_configuration() returns trigger language plpgsql set search_path = public as $$
declare v_weight numeric;
begin
  if new.package_type = 'JUMBOBAG' then
    if new.jumbobag_id is null or coalesce(new.bags_per_container, 0) < 1 then raise exception 'Jumbobag configuration requires an active Jumbobag and positive bag count'; end if;
    select weight_kg into v_weight from public.jumbobag_master where id = new.jumbobag_id and is_active;
    if v_weight is null then raise exception 'Jumbobag configuration requires an active Jumbobag'; end if;
    new.bag_weight_kg := v_weight; new.standard_mt_per_container := v_weight * new.bags_per_container / 1000; new.tolerance_percent := coalesce(new.tolerance_percent, 0);
  elsif new.package_type = 'BAG_25KG' then
    new.jumbobag_id := null; new.bag_weight_kg := 25; new.bags_per_container := null; new.standard_mt_per_container := null;
  elsif new.package_type = 'BULK_CONTAINER' then
    if coalesce(new.standard_mt_per_container, 0) <= 0 then raise exception 'Bulk Container requires MT per Container'; end if;
    new.jumbobag_id := null; new.bag_weight_kg := null; new.bags_per_container := null; new.tolerance_percent := coalesce(new.tolerance_percent, 0);
  end if;
  return new;
end;
$$;
create trigger sync_shipment_configuration before insert or update on public.shipment_configurations for each row execute function public.sync_shipment_configuration();

create or replace function public.snapshot_po_shipment_load() returns trigger language plpgsql set search_path = public as $$
declare c public.shipment_configurations%rowtype;
begin
  if new.shipment_configuration_id is null then return new; end if;
  select * into c from public.shipment_configurations where id = new.shipment_configuration_id and is_active;
  if not found then raise exception 'Shipment Configuration must be active'; end if;
  if c.package_type = 'BAG_25KG' then
    if coalesce(new.shipment_bags_per_container, 0) < 1 then raise exception 'Bag 25 kg requires a whole-number bag count'; end if;
    new.shipment_mt_per_container := new.shipment_bags_per_container * 25 / 1000; new.shipment_tolerance_percent := c.tolerance_percent;
  else
    new.shipment_bags_per_container := c.bags_per_container; new.shipment_mt_per_container := c.standard_mt_per_container; new.shipment_tolerance_percent := c.tolerance_percent;
  end if;
  return new;
end;
$$;
create trigger snapshot_po_shipment_load before insert or update on public.purchase_orders for each row execute function public.snapshot_po_shipment_load();

update public.shipment_configurations set package_type = 'BULK_CONTAINER' where shipment_mode = 'Container' and package ilike '%bulk%';
update public.shipment_configurations set package_type = 'LEGACY' where package_type = 'LEGACY';
update public.shipment_configurations set is_active = false where shipment_mode = 'Container' and package_type = 'LEGACY';

insert into public.shipment_configurations(shipment_mode, container_type, package, package_type, jumbobag_id, bags_per_container, standard_mt_per_container, is_active, remark)
select 'Container', c.container_type, 'Jumbobag ' || j.weight_kg || ' kg', 'JUMBOBAG', j.id, c.bags, 0, true, 'Normalized standard load'
from (values ('20', 850::numeric, 20), ('20', 950::numeric, 20), ('20', 1200::numeric, 20), ('40', 850::numeric, 27), ('40',850::numeric,28), ('40',850::numeric,29), ('40',850::numeric,30), ('40HQ',850::numeric,27), ('40HQ',850::numeric,28), ('40HQ',850::numeric,29), ('40HQ',850::numeric,30)) as c(container_type, weight, bags)
join public.jumbobag_master j on j.weight_kg = c.weight
where not exists (select 1 from public.shipment_configurations x where x.container_type = c.container_type and x.package_type = 'JUMBOBAG' and x.jumbobag_id = j.id and x.bags_per_container = c.bags);

insert into public.shipment_configurations(shipment_mode, container_type, package, package_type, standard_mt_per_container, tolerance_percent, is_active, remark)
select 'Container', '20', 'Bulk Container', 'BULK_CONTAINER', 20, 5, true, 'Standard Bulk: 20 MT +/-5%'
where not exists (select 1 from public.shipment_configurations where container_type = '20' and package_type = 'BULK_CONTAINER' and standard_mt_per_container = 20);

drop policy "config manage" on public.shipment_configurations;
create policy "admins manage configurations" on public.shipment_configurations for all to authenticated using (public.has_app_role('ADMIN')) with check (public.has_app_role('ADMIN'));
