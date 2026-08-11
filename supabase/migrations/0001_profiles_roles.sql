create extension if not exists pgcrypto;

create type public.app_role as enum ('EXTERNAL_SALES', 'INTERNAL', 'PRODUCTION_WAREHOUSE', 'MANAGEMENT', 'ADMIN');

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.user_profiles where auth_user_id = auth.uid() and is_active limit 1;
$$;

create or replace function public.is_active_profile() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_profile_id() is not null;
$$;

create or replace function public.has_app_role(required_role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_profiles where auth_user_id = auth.uid() and is_active and role = required_role);
$$;

create or replace function public.is_internal_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_profiles where auth_user_id = auth.uid() and is_active and role in ('INTERNAL','MANAGEMENT','ADMIN'));
$$;

create or replace function public.complete_google_login()
returns table(profile_id uuid, role public.app_role, email text)
language plpgsql security definer set search_path = public, auth as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or v_email = '' then raise exception 'Authenticated Google email is required'; end if;
  update public.user_profiles p set auth_user_id = auth.uid(), updated_at = now()
  where p.email = v_email and p.is_active and p.auth_user_id is null;
  if not exists(select 1 from public.user_profiles p where p.email = v_email and p.is_active and p.auth_user_id = auth.uid()) then
    raise exception 'Your account has not been approved';
  end if;
  return query select p.id, p.role, p.email from public.user_profiles p where p.email = v_email and p.auth_user_id = auth.uid();
end;
$$;

alter table public.user_profiles enable row level security;
create policy "users read their approved profile" on public.user_profiles for select to authenticated using (auth_user_id = auth.uid());
create policy "admins manage profiles" on public.user_profiles for all to authenticated using (public.has_app_role('ADMIN')) with check (public.has_app_role('ADMIN'));
grant execute on function public.complete_google_login(), public.is_active_profile(), public.has_app_role(public.app_role), public.current_profile_id(), public.is_internal_user() to authenticated;
