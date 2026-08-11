export async function evaluatePurchaseOrder(supabase, purchaseOrderId) {
  if (!purchaseOrderId?.trim()) throw new Error('Purchase Order ID is required');
  const { data, error } = await supabase.rpc('evaluate_po_commercial', { p_po_id: purchaseOrderId.trim() });
  if (error) throw error;
  return data?.[0];
}
