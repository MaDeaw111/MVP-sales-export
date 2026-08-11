drop policy "customer access" on public.customers;

create policy "customer read access" on public.customers
for select to authenticated
using (public.can_access_customer(id));

create policy "internal create direct customers" on public.customers
for insert to authenticated
with check (public.is_internal_user() and source = 'DIRECT_WCAT');

create policy "admins update customers" on public.customers
for update to authenticated
using (public.has_app_role('ADMIN'))
with check (public.has_app_role('ADMIN'));

create or replace function public.validate_customer_source_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.source = 'DIRECT_WCAT' then
    new.owner_profile_id := null;
  elsif new.source = 'EXTERNAL_SALES' then
    if new.owner_profile_id is null then
      raise exception 'External Sales owner is required';
    end if;
    if new.status <> 'ACTIVE_CUSTOMER' then
      raise exception 'External Sales customers must be active';
    end if;
    if not exists (
      select 1 from public.user_profiles
      where id = new.owner_profile_id
        and role = 'EXTERNAL_SALES'
        and is_active
    ) then
      raise exception 'Owner must be an active External Sales profile';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_customer_source_owner
before insert or update on public.customers
for each row execute function public.validate_customer_source_owner();

create or replace function public.record_customer_owner_change()
returns trigger language plpgsql set search_path = public as $$
declare v_changed_by uuid := public.current_profile_id();
begin
  if old.owner_profile_id is distinct from new.owner_profile_id then
    if v_changed_by is null then
      raise exception 'An approved profile is required to change customer ownership';
    end if;
    insert into public.customer_ownership_history (
      customer_id, old_owner_profile_id, new_owner_profile_id, reason, changed_by
    ) values (
      new.id, old.owner_profile_id, new.owner_profile_id, 'Admin customer edit', v_changed_by
    );
  end if;
  return new;
end;
$$;

create trigger record_customer_owner_change
after update on public.customers
for each row execute function public.record_customer_owner_change();
