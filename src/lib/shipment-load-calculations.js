export function calculateBaggedMt(weightKg, bags) {
  if (!Number.isFinite(Number(weightKg)) || Number(weightKg) <= 0 || !Number.isInteger(Number(bags)) || Number(bags) <= 0) throw new Error('Weight and bags must be positive values');
  return Math.round((Number(weightKg) * Number(bags) / 1000) * 1000) / 1000;
}

export function configurationFieldMode(packageType) {
  if (packageType === 'BULK_CONTAINER') return { showJumbobag: false, showBags: false, bagsEditable: false, mtEditable: true };
  if (packageType === 'BAG_25KG') return { showJumbobag: false, showBags: true, bagsEditable: true, mtEditable: false };
  return { showJumbobag: true, showBags: true, bagsEditable: false, mtEditable: false };
}
