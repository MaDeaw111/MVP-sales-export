import { describe, expect, it } from 'vitest';
import {
  listBagOptions,
  listContainerTypes,
  listPackages,
  listShipmentTypes,
  resolveShipmentConfiguration,
} from '../../src/lib/po-form-options.js';

const configurations = [
  { id: 'jumbo-20', is_active: true, shipment_mode: 'Container', container_type: '20', package: 'Jumbobag', package_type: 'JUMBOBAG', jumbobag_id: 'jumbo-850', bags_per_container: 20, standard_mt_per_container: 17, jumbobag_master: { weight_kg: 850 } },
  { id: 'jumbo-22', is_active: true, shipment_mode: 'Container', container_type: '20', package: 'Jumbobag', package_type: 'JUMBOBAG', jumbobag_id: 'jumbo-850', bags_per_container: 22, standard_mt_per_container: 18.7, jumbobag_master: { weight_kg: 850 } },
  { id: 'bag-25', is_active: true, shipment_mode: 'Container', container_type: '20', package: 'Bag 25 kg', package_type: 'BAG_25KG', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: null, tolerance_percent: 0, jumbobag_master: null },
  { id: 'bulk-liner', is_active: true, shipment_mode: 'Container', container_type: '20', package: 'Bulk Container + Liner', package_type: 'BULK_CONTAINER', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: 20, jumbobag_master: null },
  { id: 'bulk-container', is_active: true, shipment_mode: 'Container', container_type: '20', package: 'Bulk Container', package_type: 'BULK_CONTAINER', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: 20, jumbobag_master: null },
  { id: 'bulk-vessel', is_active: true, shipment_mode: 'Bulk Vessel', container_type: 'Vessel', package: 'Bulk', package_type: 'BULK', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: 5000, jumbobag_master: null },
  { id: 'truck', is_active: true, shipment_mode: 'Truck', container_type: 'Truck', package: 'Bulk', package_type: 'BULK', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: 20, jumbobag_master: null },
  { id: 'inactive', is_active: false, shipment_mode: 'Container', container_type: "40'", package: 'Bag 25 kg', package_type: 'BAG_25KG', jumbobag_id: null, bags_per_container: null, standard_mt_per_container: 20, jumbobag_master: null },
];

const mixedPreCorrectionConfigurations = [
  configurations.find(({ id }) => id === 'jumbo-20'),
  configurations.find(({ id }) => id === 'bulk-container'),
  { ...configurations.find(({ id }) => id === 'bulk-liner'), container_type: "20'" },
];

describe('PO form dependent selector options', () => {
  it('lists active shipment types and the configured container types', () => {
    expect(listShipmentTypes(configurations).map(({ value }) => value)).toEqual(['Bulk Vessel', 'Container', 'Truck']);
    expect(listContainerTypes(configurations, 'Container')).toEqual([{ value: '20', label: "20'" }]);
  });

  it('does not hide mixed pre-correction raw container keys behind the display label', () => {
    expect(listContainerTypes(mixedPreCorrectionConfigurations, 'Container').map(({ value }) => value))
      .toEqual(['20', "20'"]);
  });

  it('labels Jumbobags by weight and keeps every configured package distinct', () => {
    expect(listPackages(configurations, 'Container', '20').map(({ label }) => label))
      .toEqual(['Jumbobag 850 kg', 'Bag 25 kg', 'Bulk Container', 'Bulk Container + Liner']);
  });

  it('offers only the configured Jumbobag bag counts in numeric order', () => {
    const jumboSelection = { shipmentType: 'Container', containerType: '20', packageKey: 'JUMBOBAG:Jumbobag:jumbo-850' };

    expect(listBagOptions(configurations, jumboSelection).map(({ value }) => value)).toEqual(['20', '22']);
  });

  it('does not offer bag choices for 25 kg bags or bulk packages', () => {
    expect(listBagOptions(configurations, { shipmentType: 'Container', containerType: '20', packageKey: 'BAG_25KG:Bag 25 kg:' }))
      .toEqual([]);
    expect(listBagOptions(configurations, { shipmentType: 'Container', containerType: '20', packageKey: 'BULK_CONTAINER:Bulk Container:' }))
      .toEqual([]);
  });

  it('resolves a completed Jumbobag selection to exactly one configuration', () => {
    const jumboSelection = { shipmentType: 'Container', containerType: '20', packageKey: 'JUMBOBAG:Jumbobag:jumbo-850', bagsPerContainer: '20' };

    expect(resolveShipmentConfiguration(configurations, jumboSelection)).toMatchObject({ id: 'jumbo-20' });
  });

  it('does not resolve before the required selection parts are supplied', () => {
    expect(resolveShipmentConfiguration(configurations, { shipmentType: 'Container', containerType: '20' })).toBeNull();
    expect(resolveShipmentConfiguration(configurations, { shipmentType: 'Container', containerType: '20', packageKey: 'JUMBOBAG:Jumbobag:jumbo-850' })).toBeNull();
  });
});
