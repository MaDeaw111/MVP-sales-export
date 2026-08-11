revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

grant execute on function
  public.complete_google_login(),
  public.is_active_profile(),
  public.has_app_role(public.app_role),
  public.current_profile_id(),
  public.is_internal_user(),
  public.can_access_customer(uuid),
  public.create_external_customer_first_po(jsonb, jsonb),
  public.evaluate_po_commercial(uuid),
  public.approve_special_price_request(uuid, numeric, date, text),
  public.link_approved_special_price_to_po(uuid, uuid),
  public.approve_direct_po_as_special(uuid, date, text),
  public.approve_po_fx(uuid, numeric, text, date)
to authenticated;
