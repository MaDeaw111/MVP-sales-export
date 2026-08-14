# Customer Selector and PO Activation Design

## Goal

Replace the raw Customer UUID field in New PO with a Customer directory selector, and promote the chosen customer to `ACTIVE_CUSTOMER` when its first PO is created.

## User Flow

1. The New PO form loads every customer the signed-in user can read through the existing Customer directory RLS policy, regardless of current status.
2. The Customer field is a required native select. Each option displays `customer_code — name`; if code is absent, it displays the name. Its value is the existing customer UUID.
3. The browser submits the selected UUID as the unchanged `customerId` field used by `createPurchaseOrder()`.
4. After a PO insert succeeds, a database trigger changes that PO's customer status to `ACTIVE_CUSTOMER`. The insert and status transition share one transaction, so a rejected PO cannot activate a customer.

## Architecture

`renderPurchaseOrders()` will call the existing `listCustomers(supabase)` alongside its product and shipment master-data queries. It will build options through the existing DOM-safe `setSelectOptions()` helper; no Customer name is interpolated into HTML. If Customer data cannot load, the select stays disabled and PO submission cannot proceed with a manually entered UUID.

An additive Supabase migration will create an `AFTER INSERT` trigger on `purchase_orders`. It updates only the referenced customer to `ACTIVE_CUSTOMER`. Existing active customers remain active, and all sources (`DIRECT_WCAT` and `EXTERNAL_SALES`) use the same transition. The trigger does not run on PO updates, preserving the existing historical-PO behavior.

## Tests and Acceptance Criteria

- Unit view coverage proves that all readable customer statuses appear as customer options, labels use code/name, and the selected UUID is inserted as `customer_id`.
- The Customer selector is disabled when the lookup fails; raw Customer ID text input is absent.
- pgTAP inserts a PO for a `PROSPECT` customer and verifies the status is `ACTIVE_CUSTOMER`; a rejected PO leaves the customer unchanged.
- Existing PO, RLS, product/spec, and shipment tests remain green.

## Scope

This change does not alter Customer directory visibility, ownership, Customer contact data, PO document upload, or existing Customer status editing controls.
