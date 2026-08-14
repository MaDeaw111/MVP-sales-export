# Purchase Order selector design

## Goal

Replace opaque Product ID, Spec ID, and single Shipment Configuration controls
in the Purchase Order form with business-friendly dependent selectors. The
database remains the authoritative source for approved specifications and
shipment snapshots.

## Product and specification selection

The PO form displays Product choices as `Product Code — Product Name`. After a
product is selected, the Spec selector is enabled and lists only that product's
active `APPROVED` specifications. Changing the product clears the selected
specification. The submitted PO continues to store the existing product and
specification UUID foreign keys.

## Shipment selection

The form selects the existing Shipment Configuration indirectly:

```text
Shipment Type → Container Type (when required) → Package → No. of Bags
```

Shipment Type has three values: `Container`, `Bulk Vessel`, and `Truck`.
Container Type is shown only for `Container` and offers `20'`, `40'`, and
`40HQ`. Each successive selector shows only valid choices from active master
data.

For a Jumbobag configuration, Package shows the weight in its label (for
example `Jumbobag 850 kg`), and No. of Bags is a select control. For `Bag 25
kg`, No. of Bags is a required whole-number input and MT / Container is
calculated from 25 kg per bag. For `Bulk Container` and `Bulk Container +
Liner`, No. of Bags is hidden; both use `20 MT / Container ±5%`.

Bulk Vessel and Truck hide Container Type and Bags. They retain their existing
package choices and require the operator to enter MT / Shipment directly.

## Data and validation

The browser resolves the selected sequence to one active
`shipment_configurations` record and submits its UUID. It does not calculate
or submit fixed Jumbobag/Bulk payload values. The existing database trigger
continues to snapshot configuration values and protects PO history.

The database will extend the PO snapshot trigger for Bulk Vessel and Truck:
it accepts a positive manual `shipment_mt_per_container` value and retains it
as the PO's MT / Shipment snapshot. The UI validates the same requirement for
fast feedback. A missing matching active configuration blocks submission.

## Verification

- Product selector labels are readable and selecting a product filters the
  Approved Spec selector.
- Each shipment selector filters the next, and the resolved active
  configuration UUID is saved on the PO.
- Bulk Container and Liner hide Bags and display 20 MT ±5%.
- Bag 25 kg requires an integer bag count; Bulk Vessel and Truck require
  manual positive MT / Shipment.
- Unit, database/RLS, and production build checks pass before deployment.
