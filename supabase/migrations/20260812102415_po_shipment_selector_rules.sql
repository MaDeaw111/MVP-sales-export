insert into public.shipment_configurations(
  shipment_mode,
  container_type,
  package,
  package_type,
  standard_mt_per_container,
  tolerance_percent,
  is_active,
  remark
)
select
  'Container',
  '20',
  'Bulk Container + Liner',
  'BULK_CONTAINER',
  20,
  5,
  true,
  'Bulk Container + Liner: 20 MT +/-5%'
where not exists (
  select 1
  from public.shipment_configurations
  where shipment_mode = 'Container'
    and container_type = '20'
    and package = 'Bulk Container + Liner'
);

create or replace function public.snapshot_po_shipment_load()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c public.shipment_configurations%rowtype;
begin
  if new.shipment_configuration_id is null then
    return new;
  end if;

  select *
  into c
  from public.shipment_configurations
  where id = new.shipment_configuration_id
    and is_active;

  if not found then
    raise exception 'Shipment Configuration must be active';
  end if;

  if c.package_type = 'BAG_25KG' then
    if coalesce(new.shipment_bags_per_container, 0) <= 0
       or new.shipment_bags_per_container <> trunc(new.shipment_bags_per_container) then
      raise exception '25 kg bag configuration requires a positive whole-number bag count';
    end if;
    new.shipment_mt_per_container := round((new.shipment_bags_per_container * 25)::numeric / 1000, 3);
  elsif c.shipment_mode in ('Bulk Vessel', 'Truck') then
    if coalesce(new.shipment_mt_per_container, 0) <= 0 then
      raise exception '% configuration requires a positive MT / Shipment value', c.shipment_mode;
    end if;
    new.shipment_bags_per_container := null;
    new.shipment_tolerance_percent := coalesce(c.tolerance_percent, 0);
  else
    new.shipment_bags_per_container := c.bags_per_container;
    new.shipment_mt_per_container := c.standard_mt_per_container;
    new.shipment_tolerance_percent := coalesce(c.tolerance_percent, 0);
  end if;

  return new;
end;
$$;
