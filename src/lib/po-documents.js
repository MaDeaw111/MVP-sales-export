export function buildPoDocumentPath({ customerId, poId, documentId, version, fileName }) {
  if (!customerId || !poId || !documentId || !version || !fileName) throw new Error('Customer, PO, document, version, and file name are required');
  return `customer-po/${customerId}/${poId}/${documentId}/v${version}/${fileName}`;
}

export async function uploadPoDocument(supabase, path, file) {
  const { error } = await supabase.storage.from('customer-po-private').upload(path, file, { upsert: false });
  if (error) throw error;
}
