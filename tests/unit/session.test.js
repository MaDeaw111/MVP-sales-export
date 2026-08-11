import { describe, expect, it } from 'vitest';
import { completeApprovedSession } from '../../src/lib/session.js';

describe('completeApprovedSession', () => {
  it('returns the approved profile from the Google-login RPC', async () => {
    const supabase = { rpc: async () => ({ data: [{ profile_id: 'p1', role: 'EXTERNAL_SALES', email: 'sales@example.com' }], error: null }) };
    await expect(completeApprovedSession(supabase)).resolves.toMatchObject({ profile_id: 'p1', role: 'EXTERNAL_SALES' });
  });
});
