const collator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' });

const packageTypeOrder = {
  JUMBOBAG: 0,
  BAG_25KG: 1,
  BULK_CONTAINER: 2,
};

function activeConfigurations(configurations) {
  return configurations.filter((configuration) => configuration.is_active !== false);
}

function uniqueOptions(configurations, toOption, compare) {
  const options = new Map();
  for (const configuration of configurations) {
    const option = toOption(configuration);
    if (!options.has(option.value)) options.set(option.value, option);
  }
  return [...options.values()].sort(compare);
}

function optionOrder(left, right) {
  return collator.compare(left.label, right.label) || collator.compare(left.value, right.value);
}

function containerTypeLabel(containerType) {
  return containerType === '20' ? "20'" : containerType;
}

export function packageKey(configuration) {
  return `${configuration.package_type}:${configuration.package}:${configuration.jumbobag_id ?? ''}`;
}

export function packageLabel(configuration) {
  const weight = configuration.jumbobag_master?.weight_kg;
  return configuration.package_type === 'JUMBOBAG' && weight
    ? `Jumbobag ${Number(weight).toLocaleString('en-US')} kg`
    : configuration.package;
}

export function listShipmentTypes(configurations) {
  return uniqueOptions(activeConfigurations(configurations),
    ({ shipment_mode }) => ({ value: shipment_mode, label: shipment_mode }), optionOrder);
}

export function listContainerTypes(configurations, shipmentType) {
  if (!shipmentType) return [];
  return uniqueOptions(activeConfigurations(configurations).filter(({ shipment_mode }) => shipment_mode === shipmentType),
    ({ container_type }) => ({ value: container_type, label: containerTypeLabel(container_type) }), optionOrder);
}

export function listPackages(configurations, shipmentType, containerType) {
  if (!shipmentType || (shipmentType === 'Container' && !containerType)) return [];
  const matchingConfigurations = activeConfigurations(configurations).filter((configuration) => (
    configuration.shipment_mode === shipmentType
    && (shipmentType !== 'Container' || configuration.container_type === containerType)
  ));
  return uniqueOptions(matchingConfigurations,
    (configuration) => ({ value: packageKey(configuration), label: packageLabel(configuration), packageType: configuration.package_type }),
    (left, right) => (packageTypeOrder[left.packageType] ?? Number.MAX_SAFE_INTEGER) - (packageTypeOrder[right.packageType] ?? Number.MAX_SAFE_INTEGER)
      || optionOrder(left, right));
}

export function listBagOptions(configurations, selection) {
  if (!selection?.shipmentType || !selection?.containerType || !selection?.packageKey) return [];
  const matchingConfigurations = activeConfigurations(configurations).filter((configuration) => (
    configuration.shipment_mode === selection.shipmentType
    && configuration.container_type === selection.containerType
    && packageKey(configuration) === selection.packageKey
    && configuration.package_type === 'JUMBOBAG'
    && configuration.bags_per_container != null
  ));
  return uniqueOptions(matchingConfigurations,
    ({ bags_per_container }) => ({ value: String(bags_per_container), label: String(bags_per_container) }), optionOrder);
}

export function resolveShipmentConfiguration(configurations, selection) {
  if (!selection?.shipmentType || !selection?.packageKey) return null;
  if (selection.shipmentType === 'Container' && !selection.containerType) return null;

  const matchingConfigurations = activeConfigurations(configurations).filter((configuration) => (
    configuration.shipment_mode === selection.shipmentType
    && packageKey(configuration) === selection.packageKey
    && (selection.shipmentType !== 'Container' || configuration.container_type === selection.containerType)
  ));
  const packageType = matchingConfigurations[0]?.package_type;
  if (packageType === 'JUMBOBAG' && (selection.bagsPerContainer === '' || selection.bagsPerContainer == null)) return null;

  const resolved = packageType === 'JUMBOBAG'
    ? matchingConfigurations.filter(({ bags_per_container }) => String(bags_per_container) === String(selection.bagsPerContainer))
    : matchingConfigurations;
  return resolved.length === 1 ? resolved[0] : null;
}
