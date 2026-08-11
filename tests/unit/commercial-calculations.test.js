import { describe, expect, it } from 'vitest';
import { calculateFobEquivalentUsdMt } from '../../src/lib/commercial-calculations.js';

describe('calculateFobEquivalentUsdMt', () => {
  it('subtracts commission for FOB USD orders', () => {
    expect(calculateFobEquivalentUsdMt({ currency: 'USD', sellingPrice: 500, commissionUsdMt: 20, incoterm: 'FOB' })).toBe(480);
  });

  it('converts EUR and subtracts freight for CIF orders', () => {
    expect(calculateFobEquivalentUsdMt({ currency: 'EUR', sellingPrice: 460, fxRate: 0.92, commissionUsdMt: 10, freightSnapshotUsdMt: 30, incoterm: 'CIF' })).toBe(460);
  });
});
