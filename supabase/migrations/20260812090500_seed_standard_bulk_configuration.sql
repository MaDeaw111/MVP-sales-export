insert into public.shipment_configurations(
  shipment_mode, container_type, package, package_type,
  standard_mt_per_container, tolerance_percent, is_active, remark
)
select 'Container', '20', 'Bulk Container', 'BULK_CONTAINER', 20, 5, true, 'Standard Bulk: 20 MT +/-5%'
where not exists (
  select 1 from public.shipment_configurations
  where package_type = 'BULK_CONTAINER'
    and is_active
    and remark = 'Standard Bulk: 20 MT +/-5%'
);
