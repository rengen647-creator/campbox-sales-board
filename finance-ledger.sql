-- Finance ledger: monthly commission obligations; actual receipts remain in salary_payments.
create table if not exists public.sales_finance_charges (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.salary_contracts(id) on delete restrict,
 month date not null check(month=date_trunc('month',month)::date),
 amount numeric(14,2) not null check(amount>=0),
 due_date date,
 note text not null default '',
 created_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(contract_id,month)
);
create index if not exists sales_finance_charges_month_idx on public.sales_finance_charges(month);
create index if not exists sales_finance_charges_contract_idx on public.sales_finance_charges(contract_id);
alter table public.sales_finance_charges enable row level security;
revoke all on public.sales_finance_charges from anon,authenticated;
grant select,insert,update,delete on public.sales_finance_charges to authenticated;
drop policy if exists sales_finance_charges_manager_read on public.sales_finance_charges;
create policy sales_finance_charges_manager_read on public.sales_finance_charges for select to authenticated using(public.is_manager());
drop policy if exists sales_finance_charges_manager_insert on public.sales_finance_charges;
create policy sales_finance_charges_manager_insert on public.sales_finance_charges for insert to authenticated with check(public.is_manager());
drop policy if exists sales_finance_charges_manager_update on public.sales_finance_charges;
create policy sales_finance_charges_manager_update on public.sales_finance_charges for update to authenticated using(public.is_manager()) with check(public.is_manager());
drop policy if exists sales_finance_charges_manager_delete on public.sales_finance_charges;
create policy sales_finance_charges_manager_delete on public.sales_finance_charges for delete to authenticated using(public.is_manager());
-- Actual payments reuse salary_payments, not duplicated in a second ledger.
