import { expect, it } from 'vitest';
import { calculateBaggedMt, configurationFieldMode } from '../../src/lib/shipment-load-calculations.js';

it('calculates a 28 x 850 kg load', () => {
  expect(calculateBaggedMt(850, 28)).toBe(23.8);
});

it('hides bags and allows direct MT for Bulk', () => {
  expect(configurationFieldMode('BULK_CONTAINER')).toEqual({ showJumbobag: false, showBags: false, bagsEditable: false, mtEditable: true });
});
