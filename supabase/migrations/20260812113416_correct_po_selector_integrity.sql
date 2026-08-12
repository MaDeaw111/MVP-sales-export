update public.shipment_configurations
set container_type = '20'
where shipment_mode = 'Container'
  and trim(container_type) = '20''';

create or replace function public.reconcile_liner_shipment_configurations()
returns void
language plpgsql
set search_path = public
as $$
declare
  v_canonical_id uuid;
begin
  select id
  into v_canonical_id
  from public.shipment_configurations
  where lower(trim(package)) = 'bulk container + liner'
  order by is_active desc, id
  limit 1;

  update public.shipment_configurations
  set is_active = false
  where lower(trim(package)) = 'bulk container + liner';

  update public.shipment_configurations
  set
    shipment_mode = 'Container',
    container_type = '20',
    package = 'Bulk Container + Liner',
    package_type = 'BULK_CONTAINER',
    standard_mt_per_container = 20.000,
    tolerance_percent = 5.000,
    remark = 'Bulk Container + Liner: 20 MT +/-5%'
  where lower(trim(package)) = 'bulk container + liner';

  if v_canonical_id is null then
    insert into public.shipment_configurations(
      shipment_mode,
      container_type,
      package,
      package_type,
      standard_mt_per_container,
      tolerance_percent,
      is_active,
      remark
    ) values (
      'Container',
      '20',
      'Bulk Container + Liner',
      'BULK_CONTAINER',
      20.000,
      5.000,
      true,
      'Bulk Container + Liner: 20 MT +/-5%'
    );
  else
    update public.shipment_configurations
    set is_active = true
    where id = v_canonical_id;
  end if;
end;
$$;

select public.reconcile_liner_shipment_configurations();

drop index if exists public.shipment_configurations_one_active_bulk_liner_20_idx;
create unique index shipment_configurations_one_active_bulk_liner_20_idx
  on public.shipment_configurations ((true))
  where is_active
    and shipment_mode = 'Container'
    and container_type = '20'
    and package = 'Bulk Container + Liner';

create or replace function public.reconcile_bag_25kg_shipment_configurations()
returns void
language plpgsql
set search_path = public
as $$
declare
  v_canonical_id uuid;
begin
  select id
  into v_canonical_id
  from public.shipment_configurations
  where shipment_mode = 'Container'
    and trim(container_type) in ('20', '20''')
    and (
      package_type = 'BAG_25KG'
      or lower(trim(package)) in ('bag 25 kg', '25 kg bag')
    )
  order by is_active desc, id
  limit 1;

  update public.shipment_configurations
  set is_active = false
  where shipment_mode = 'Container'
    and trim(container_type) in ('20', '20''')
    and (
      package_type = 'BAG_25KG'
      or lower(trim(package)) in ('bag 25 kg', '25 kg bag')
    );

  update public.shipment_configurations
  set
    shipment_mode = 'Container',
    container_type = '20',
    package = 'Bag 25 kg',
    package_type = 'BAG_25KG',
    jumbobag_id = null,
    bag_weight_kg = 25.000,
    bags_per_container = null,
    standard_mt_per_container = null,
    tolerance_percent = 0.000,
    remark = 'Bag 25 kg: bag count entered on Purchase Order'
  where shipment_mode = 'Container'
    and trim(container_type) in ('20', '20''')
    and (
      package_type = 'BAG_25KG'
      or lower(trim(package)) in ('bag 25 kg', '25 kg bag')
    );

  if v_canonical_id is null then
    insert into public.shipment_configurations(
      shipment_mode,
      container_type,
      package,
      package_type,
      bag_weight_kg,
      bags_per_container,
      standard_mt_per_container,
      tolerance_percent,
      is_active,
      remark
    ) values (
      'Container',
      '20',
      'Bag 25 kg',
      'BAG_25KG',
      25.000,
      null,
      null,
      0.000,
      true,
      'Bag 25 kg: bag count entered on Purchase Order'
    );
  else
    update public.shipment_configurations
    set is_active = true
    where id = v_canonical_id;
  end if;
end;
$$;

select public.reconcile_bag_25kg_shipment_configurations();

create unique index shipment_configurations_one_active_bag_25kg_20_idx
  on public.shipment_configurations ((true))
  where is_active
    and shipment_mode = 'Container'
    and container_type = '20'
    and package_type = 'BAG_25KG';

alter table public.shipment_configurations
  add constraint shipment_configurations_canonical_20_foot_key
  check (
    shipment_mode <> 'Container'
    or trim(container_type) <> '20'''
  );

revoke execute on function public.reconcile_liner_shipment_configurations() from public, anon, authenticated;
revoke execute on function public.reconcile_bag_25kg_shipment_configurations() from public, anon, authenticated;

create or replace function public.snapshot_po_shipment_load()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c public.shipment_configurations%rowtype;
begin
  if tg_op = 'UPDATE'
     and new.shipment_configuration_id is not distinct from old.shipment_configuration_id then
    if new.shipment_configuration_id is null then
      new.shipment_bags_per_container := old.shipment_bags_per_container;
      new.shipment_mt_per_container := old.shipment_mt_per_container;
      new.shipment_tolerance_percent := old.shipment_tolerance_percent;
      return new;
    end if;

    select *
    into c
    from public.shipment_configurations
    where id = new.shipment_configuration_id;

    if not (
      (c.package_type = 'BAG_25KG'
        and new.shipment_bags_per_container is distinct from old.shipment_bags_per_container)
      or (c.shipment_mode in ('Bulk Vessel', 'Truck')
        and new.shipment_mt_per_container is distinct from old.shipment_mt_per_container)
    ) then
      new.shipment_bags_per_container := old.shipment_bags_per_container;
      new.shipment_mt_per_container := old.shipment_mt_per_container;
      new.shipment_tolerance_percent := old.shipment_tolerance_percent;
      return new;
    end if;
  end if;

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
    new.shipment_tolerance_percent := coalesce(c.tolerance_percent, 0);
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

revoke execute on function public.snapshot_po_shipment_load() from public, anon, authenticated;

create or replace function public.validate_po_product_spec_selection()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.product_id is not distinct from old.product_id
     and new.product_spec_id is not distinct from old.product_spec_id then
    return new;
  end if;

  if not exists (
    select 1
    from public.products product
    join public.product_specs spec
      on spec.product_id = product.id
    where product.id = new.product_id
      and product.is_active
      and spec.id = new.product_spec_id
      and spec.status = 'APPROVED'
  ) then
    raise exception 'Product must be active and Product Spec must be APPROVED for that Product';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_po_product_spec_selection on public.purchase_orders;
create trigger validate_po_product_spec_selection
before insert or update of product_id, product_spec_id
on public.purchase_orders
for each row
execute function public.validate_po_product_spec_selection();

revoke execute on function public.validate_po_product_spec_selection() from public, anon, authenticated;
