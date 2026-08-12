# Product Spec master-data design

## Goal

Import the 12 completed rows in `Data/Product_Spec.xlsx` as approved product
definitions and give Admin a practical way to maintain product data without
rewriting an approved technical specification.

## Product and specification rule

A WCAT product code represents one stable commercial and technical product
definition. Each imported product receives one `APPROVED` Product Spec,
version `1.0`, containing the workbook's technical limits in `parameters`.

An approved technical specification is immutable. A changed technical limit is
a new product, not a revision of the current product. The replacement product
must receive a new product code and its own approved specification. Existing
prices and POs therefore remain unambiguous.

## Admin experience

The Products & Specs area will provide:

- a product/specification list with code, name, short name, approval state and
  key technical limits;
- an Admin-only detail editor for non-technical product master fields: name,
  short name, description and remark;
- a read-only display of approved technical limits;
- a `Create new product from this spec` flow that copies the current values,
  requires a new product code, permits technical changes, and creates the new
  product plus one approved `1.0` specification atomically.

Non-Admin users may read approved master data but cannot change it. The
existing RLS policies remain the authorization boundary.

## Data import

Only the 12 rows with both Product_Code and Product_Name are imported. Blank
rows PROD-013 through PROD-018 are ignored. Workbook columns map as follows:

- Product_Code -> `products.code`
- Product_Name -> `products.name`
- Short_Name -> product description/short-name metadata
- Starch, Moisture, Sand/Silica, Crude Fiber, Crude Protein, Crude Fat and Ash
  -> `product_specs.parameters` JSON

The import is idempotent and will not overwrite an existing product or
approved specification.

## Verification

- Admin can view the 12 approved specs and update allowed product fields.
- Admin cannot alter approved technical values in place.
- Creating a derived product requires a distinct product code and creates one
  approved `1.0` spec with the selected technical values.
- Existing unit tests and production build pass before deployment.
