import { describe, expect, it } from 'vitest';
import { buildPoDocumentPath } from '../../src/lib/po-documents.js';
describe('PO document paths',()=>{it('uses the customer/PO/document/version storage path',()=>{expect(buildPoDocumentPath({customerId:'c1',poId:'p1',documentId:'d1',version:2,fileName:'PO.pdf'})).toBe('customer-po/c1/p1/d1/v2/PO.pdf');});});
