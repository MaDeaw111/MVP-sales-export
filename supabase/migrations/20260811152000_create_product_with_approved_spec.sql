create or replace function public.create_product_with_approved_spec(p_product jsonb, p_spec jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_code text := trim(coalesce(p_product ->> 'code', ''));
  v_name text := trim(coalesce(p_product ->> 'name', ''));
  v_short_name text := trim(coalesce(p_product ->> 'short_name', ''));
  v_spec_name text := trim(coalesce(p_spec ->> 'name', ''));
  v_version text := trim(coalesce(p_spec ->> 'version', ''));
  v_parameters jsonb := coalesce(p_spec -> 'parameters', '{}'::jsonb);
begin
  if not public.has_app_role('ADMIN') then
    raise exception 'Only an Admin can create a product from a specification';
  end if;

  if v_code = '' or v_name = '' or v_short_name = '' or v_spec_name = '' or v_version = '' then
    raise exception 'Product code, product name, short name, specification name, and version are required';
  end if;

  if jsonb_typeof(v_parameters) <> 'object' then
    raise exception 'Technical limits must be a JSON object';
  end if;

  insert into public.products (code, name, description, is_active)
  values (v_code, v_name, 'Short name: ' || v_short_name, true)
  returning id into v_product_id;

  insert into public.product_specs (product_id, name, version, status, effective_date, parameters, note)
  values (v_product_id, v_spec_name, v_version, 'APPROVED', current_date, v_parameters || jsonb_build_object('short_name', v_short_name), p_spec ->> 'note');

  return v_product_id;
end;
$$;

revoke execute on function public.create_product_with_approved_spec(jsonb, jsonb) from public, anon;
grant execute on function public.create_product_with_approved_spec(jsonb, jsonb) to authenticated;
