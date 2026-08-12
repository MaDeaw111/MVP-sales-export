export async function evaluatePurchaseOrder(supabase, purchaseOrderId) {
  if (!purchaseOrderId?.trim()) throw new Error('Purchase Order ID is required');
  const { data, error } = await supabase.rpc('evaluate_po_commercial', { p_po_id: purchaseOrderId.trim() });
  if (error) throw error;
  return data?.[0];
}
export async function createPurchaseOrder(supabase, values) {
  if (values.incoterm !== 'FOB' && !values.freightSnapshot) throw new Error('Freight snapshot USD/MT is required for CIF/CNF');
  if (values.currency !== 'USD' && !values.fxRate) throw new Error('FX rate is required for EUR/THB');
  validateShipmentSelection({ packageType: values.shipmentPackageType, shipmentType: values.shipmentType, bags: values.shipmentBagsPerContainer, mtPerShipment: values.manualShipmentMt });
  const payload={customer_id:values.customerId,customer_po_number:values.number,po_date:values.date,product_id:values.productId,product_spec_id:values.specId,shipment_configuration_id:values.shipmentConfigurationId||null,shipment_bags_per_container:values.shipmentBagsPerContainer ? Number(values.shipmentBagsPerContainer) : null,shipment_mt_per_container:values.manualShipmentMt === '' || values.manualShipmentMt == null ? null : Number(values.manualShipmentMt),contract_quantity_mt:Number(values.quantity),incoterm:values.incoterm,destination:values.destination,currency:values.currency,final_selling_price:Number(values.sellingPrice),commission_usd_mt:Number(values.commission||0),freight_snapshot_usd_mt:values.incoterm==='FOB'?null:Number(values.freightSnapshot),fx_rate:values.currency==='USD'?null:Number(values.fxRate),fx_bank_name:values.fxBank||null,fx_rate_date:values.fxDate||null};
  const {data,error}=await supabase.from('purchase_orders').insert(payload).select('id').single();if(error)throw error;return data;
}
export function validateShipmentSelection({ packageType, shipmentType, bags, mtPerShipment }) {
  if (packageType === 'BAG_25KG' && (!Number.isInteger(Number(bags)) || Number(bags) < 1)) throw new Error('Bag 25 kg requires a whole-number bag count');
  if (shipmentType === 'Bulk Vessel' || shipmentType === 'Truck') {
    if (!Number.isFinite(Number(mtPerShipment)) || Number(mtPerShipment) <= 0) throw new Error(`${shipmentType} requires a positive MT / Shipment value`);
  }
}
export async function approvePurchaseOrderFx(supabase, purchaseOrderId, fxRate, bankName, rateDate) {
  const { data, error } = await supabase.rpc('approve_po_fx', { p_po_id: purchaseOrderId, p_fx_rate: Number(fxRate), p_bank_name: bankName, p_rate_date: rateDate });
  if (error) throw error;
  return data;
}
