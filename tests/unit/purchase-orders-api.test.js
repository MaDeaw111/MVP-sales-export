import { describe, expect, it } from 'vitest';
import { evaluatePurchaseOrder } from '../../src/lib/purchase-orders-api.js';
describe('purchase orders API', () => { it('evaluates a saved PO through the canonical database RPC', async () => { let args; const supabase={rpc:(name,value)=>{args={name,value};return Promise.resolve({data:[{decision:'AUTO_PASS'}],error:null});}}; await expect(evaluatePurchaseOrder(supabase,'po-1')).resolves.toEqual({decision:'AUTO_PASS'}); expect(args).toEqual({name:'evaluate_po_commercial',value:{p_po_id:'po-1'}}); }); });
