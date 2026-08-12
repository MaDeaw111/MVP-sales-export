export async function listShipmentConfigurations(supabase, { includeInactive = false } = {}) {
  let query = supabase.from('shipment_configurations').select('id,shipment_mode,container_type,package,package_type,jumbobag_id,bags_per_container,standard_mt_per_container,tolerance_percent,is_active,remark,jumbobag_master(weight_kg)');
  if (!includeInactive) query = query.eq('is_active', true);
  query = query.order('container_type');
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createShipmentConfiguration(supabase, values) {
  if (!values.containerType || !values.packageType) throw new Error('Container type and package are required');
  let payload;
  if (values.packageType === 'JUMBOBAG') {
    if (!values.jumbobagId || !Number.isInteger(Number(values.bagsPerContainer)) || Number(values.bagsPerContainer) < 1) throw new Error('Jumbobag and bag count are required');
    payload = { shipment_mode: 'Container', container_type: values.containerType, package: 'Jumbobag', package_type: 'JUMBOBAG', jumbobag_id: values.jumbobagId, bags_per_container: Number(values.bagsPerContainer), is_active: true };
  } else if (values.packageType === 'BULK_CONTAINER') {
    if (!Number.isFinite(Number(values.standardMt)) || Number(values.standardMt) <= 0) throw new Error('Bulk Container requires MT per Container');
    payload = { shipment_mode: 'Container', container_type: values.containerType, package: 'Bulk Container', package_type: 'BULK_CONTAINER', bags_per_container: null, standard_mt_per_container: Number(values.standardMt), tolerance_percent: Number(values.tolerancePercent || 0), is_active: true };
  } else {
    payload = { shipment_mode: 'Container', container_type: values.containerType, package: 'Bag 25 kg', package_type: 'BAG_25KG', bags_per_container: null, is_active: true };
  }
  const { data, error } = await supabase.from('shipment_configurations').insert(payload).select('id').single();
  if (error) throw error;
  return data;
}
