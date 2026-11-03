-- Credit month: first confirmed move from negotiating to signed (Moscow local date).
-- Legal contract signed_date is preserved for documents and CSM.
-- Existing legacy contracts with no credit date retain signed_date as fallback.
alter table public.salary_contracts add column if not exists credited_date date;
comment on column public.salary_contracts.credited_date is
  'Sales and contractor bonus credit date on first confirmed signed-status transfer; separate from the document signed_date.';
create index if not exists salary_contracts_credited_date_idx on public.salary_contracts(credited_date)
  where credited_date is not null;
create or replace function campbox_internal.stamp_sales_contract_credit_date()
returns trigger language plpgsql set search_path='' as $fn$
begin
  if new.sales_source_contract_key is null then return new; end if;
  if tg_op='INSERT' then
    if new.credited_date is null then
      new.credited_date := (pg_catalog.now() at time zone 'Europe/Moscow')::date;
    end if;
  elsif tg_op='UPDATE' then
    if old.sales_source_contract_key is null and new.credited_date is null then
      new.credited_date := (pg_catalog.now() at time zone 'Europe/Moscow')::date;
    end if;
  end if;
  return new;
end
$fn$;
drop trigger if exists stamp_sales_contract_credit_date on public.salary_contracts;
create trigger stamp_sales_contract_credit_date
before insert or update of sales_source_contract_key on public.salary_contracts
for each row execute function campbox_internal.stamp_sales_contract_credit_date();
