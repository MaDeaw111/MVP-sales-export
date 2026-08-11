# Admin Customer Editing Design

## Goal

Allow an Admin to edit Customer Code, Customer Name, Status, Source, and the
External Sales owner from the Customer Detail page without breaking customer
ownership rules.

## Experience

- A customer name opens its Customer Detail page.
- Admins see an **Edit customer** control above the detail sections.
- The edit form has inputs for code and name, selects for status and source,
  and an owner select.
- The owner select is required and visible only for `EXTERNAL_SALES`.
- Choosing `DIRECT_WCAT` clears the selected owner. Choosing
  `EXTERNAL_SALES` requires an active External Sales profile and submits the
  customer as `ACTIVE_CUSTOMER`.
- Non-Admin users see the detail page without the edit control.

## Authorization and validation

- Database RLS splits customer access: authorized users can read; internal
  roles can create Direct WCAT prospects; only Admin can update customers.
- A database trigger validates source/status/owner changes so direct SQL or a
  modified browser client cannot create an External Sales customer without a
  valid owner and active status.
- The client validates the same conditions for clear feedback, then sends a
  single update.

## Tests

- pgTAP proves the Admin-only update policy and validation trigger exist.
- Vitest proves the edit API sends the expected update and rejects an External
  Sales update without an owner.
- Existing Customer, database, and production-build tests remain green.
