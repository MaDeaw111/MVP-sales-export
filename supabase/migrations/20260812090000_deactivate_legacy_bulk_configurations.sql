update public.shipment_configurations
set is_active = false
where package_type = 'BULK_CONTAINER'
  and coalesce(remark, '') <> 'Standard Bulk: 20 MT +/-5%';
