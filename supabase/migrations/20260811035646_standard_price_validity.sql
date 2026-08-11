
create or replace function public.set_standard_price_valid_until()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.valid_until is null then new.valid_until := new.effective_date + interval '3 months'; end if;
  return new;
end;
$$;

alter table public.standard_fob_prices alter column valid_until drop not null;
create trigger set_standard_price_valid_until
before insert on public.standard_fob_prices
for each row execute function public.set_standard_price_valid_until();
