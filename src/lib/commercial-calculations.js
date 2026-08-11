export function calculateFobEquivalentUsdMt({
  currency,
  sellingPrice,
  fxRate,
  commissionUsdMt = 0,
  freightSnapshotUsdMt = 0,
  incoterm,
}) {
  if (currency !== 'USD' && (!fxRate || fxRate <= 0)) {
    throw new Error('An approved FX rate is required for EUR and THB orders');
  }
  const sellingUsdMt = currency === 'USD' ? sellingPrice : sellingPrice / fxRate;
  return sellingUsdMt - commissionUsdMt - (incoterm === 'FOB' ? 0 : freightSnapshotUsdMt);
}
