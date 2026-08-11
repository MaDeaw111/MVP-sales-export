export function buildPoDocumentPath({ customerId, poId, documentId, version, fileName }) {
  if (!customerId || !poId || !documentId || !version || !fileName) throw new Error('Customer, PO, document, version, and file name are required');
  return `customer-po/${customerId}/${poId}/${documentId}/v${version}/${fileName}`;
}

export async function createPoDocument(supabase, poId) {
  const { data, error } = await supabase.from('documents').insert({ po_id: poId, document_type: 'CUSTOMER_PO' }).select('id').single();
  if (error) throw error;
  return data;
}

export async function registerPoDocumentVersion(supabase, { documentId, path, file }) {
  const { data, error } = await supabase.from('document_versions').insert({
    document_id: documentId,
    version_number: 1,
    object_path: path,
    original_filename: file.name,
    mime_type: file.type || null,
    byte_size: file.size,
  }).select('id').single();
  if (error) throw error;
  return data;
}

export async function uploadNewPoDocument(supabase, { customerId, poId, file }) {
  const document = await createPoDocument(supabase, poId);
  const path = buildPoDocumentPath({ customerId, poId, documentId: document.id, version: 1, fileName: file.name });
  await uploadPoDocument(supabase, path, file);
  await registerPoDocumentVersion(supabase, { documentId: document.id, path, file });
  return { documentId: document.id, path };
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
