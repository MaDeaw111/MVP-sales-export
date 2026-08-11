export function buildPoDocumentPath({ customerId, poId, documentId, version, fileName }) {
  if (!customerId || !poId || !documentId || !version || !fileName) throw new Error('Customer, PO, document, version, and file name are required');
  return `customer-po/${customerId}/${poId}/${documentId}/v${version}/${fileName}`;
}

export async function createPoDocument(supabase, poId) {
  const { data, error } = await supabase.from('documents').insert({ po_id: poId, document_type: 'CUSTOMER_PO' }).select('id').single();
  if (error) throw error;
  return data;
}

export async function uploadPoDocument(supabase, path, file) {
  const { error } = await supabase.storage.from('customer-po-private').upload(path, file, { upsert: false });
  if (error) throw error;
}

export async function createPoDocumentDownloadUrl(supabase, path) {
  const { data, error } = await supabase.storage.from('customer-po-private').createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
