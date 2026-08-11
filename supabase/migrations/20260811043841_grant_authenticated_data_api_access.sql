
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.customers,
  public.customer_contacts,
  public.crm_activities,
  public.action_required,
  public.products,
  public.product_specs,
  public.shipment_configurations,
  public.product_shipment_configurations,
  public.standard_fob_prices,
  public.special_price_requests,
  public.purchase_orders,
  public.documents,
  public.document_versions
to authenticated;
grant select, insert on public.customer_ownership_history to authenticated;
