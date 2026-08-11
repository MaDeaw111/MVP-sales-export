# Shipment Configuration design

## Goal

Make each selectable shipment configuration a consistent, reportable loading
format. The Purchase Order flow will select a configuration rather than accept
free-text container, package, or Jumbobag values.

## Master data

Create a separate `Jumbobag Master` managed by Admin. It starts with the three
active standard weights: 850 kg, 950 kg, and 1,200 kg. A new Jumbobag weight
must be added here before it can be used in any configuration. Existing
weights can be deactivated but remain visible on historic records.

Shipment Configuration retains one record for each permitted selection:

- Container Type: 20', 40', or 40HQ;
- Package: Jumbobag, Bag 25 kg, or Bulk Container;
- Jumbobag weight: required only for Jumbobag and selected from Jumbobag
  Master;
- permitted number of bags, where applicable;
- MT per Container and tolerance;
- active state and remark.

The existing Bulk Vessel and Truck entries remain outside the container
configuration form because their payload is set per shipment.

## Calculation and form rules

The Admin form uses three package behaviours:

| Package | No. of Bags | MT / Container |
| --- | --- | --- |
| Jumbobag | Select from the permitted bags list | Calculated: Jumbobag kg x bags / 1,000 |
| Bag 25 kg | Admin enters a positive whole number | Calculated: 25 kg x bags / 1,000 |
| Bulk Container | Hidden | Admin enters MT directly and may set tolerance, e.g. 20 MT +/-5% |

Jumbobag bag quantities are controlled choices, not free text. They will be
seeded from the supplied package data (including 20 bags for 20' loads and
27/28/29/30 bags where supported for 40'/40HQ) and can later be maintained by
Admin. Bag 25 kg remains manual because it is used infrequently.

## User experience and reporting

The Shipment Config Admin page lists the standard loading pattern, calculated
payload, tolerance, active state, and usage count. The edit form dynamically
shows only relevant fields for the selected Package type. It validates that a
Jumbobag is active and its bag count is one of the permitted choices.

Each PO stores the selected Shipment Configuration. Reporting can then group
by container type, package, Jumbobag weight, and bag count to show which
loading format is used most often. Historic PO selections remain readable if a
configuration or a Jumbobag master item is later deactivated.

## Migration and verification

The migration introduces the Jumbobag master, extends the existing shipment
configuration schema for its package-specific fields, and migrates the current
22 active records without discarding them. RLS keeps read access available to
approved users and limits all master-data writes to internal/Admin roles.

Verification covers calculated payloads, Bulk field visibility, Jumbobag
weight and bag-count validation, manual Bag 25 kg counts, and the ability to
report PO usage by configuration.
