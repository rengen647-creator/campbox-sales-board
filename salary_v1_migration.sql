-- CampBox Sales Board — Salary V1 migration
-- Выполнить целиком в Supabase SQL Editor один раз.
-- Скрипт идемпотентен: повторный запуск не создаёт дубли таблиц.

create table if not exists public.salary_clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  contractor_id uuid references public.profiles(id) on delete set null,
  signed_date date,
  notes text default '',
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salary_client_products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.salary_clients(id) on delete cascade,
  product_type text not null check (product_type in (
    'campbox','order_management','comfort_booking','maps','site','site_support'
  )),
  first_payment_date date,
  active boolean not null default true,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, product_type)
);

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  payment_date date not null,
  client_id uuid not null references public.salary_clients(id) on delete cascade,
  product_type text not null check (product_type in (
    'campbox','order_management','comfort_booking','maps','site','site_support'
  )),
  event_type text not null default 'payment' check (event_type in ('payment','site_live')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  payment_number integer check (payment_number is null or payment_number > 0),
  external_ref text default '',
  status text not null default 'confirmed' check (status in ('preliminary','confirmed','paid','excluded')),
  comment text default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salary_department_months (
  month date primary key,
  target_plan integer not null default 0 check (target_plan >= 0),
  actual_sales integer not null default 0 check (actual_sales >= 0),
  completion_pct numeric(8,2) not null default 0,
  contractor_rate numeric(12,2) not null default 0 check (contractor_rate >= 0),
  finalized boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (month = date_trunc('month', month)::date)
);

create table if not exists public.salary_config (
  id smallint primary key default 1 check (id = 1),
  sales_head_id uuid references public.profiles(id) on delete set null,
  vat_rate numeric(6,2) not null default 22 check (vat_rate >= 0 and vat_rate < 100),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.salary_config add column if not exists vat_rate numeric(6,2) not null default 22;

insert into public.salary_config(id,vat_rate) values(1,22) on conflict (id) do nothing;

create table if not exists public.salary_audit (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.salary_audit alter column entity_id type text using entity_id::text;

create index if not exists salary_clients_contractor_idx on public.salary_clients(contractor_id);
create index if not exists salary_clients_signed_date_idx on public.salary_clients(signed_date);
create index if not exists salary_products_client_idx on public.salary_client_products(client_id);
create index if not exists salary_products_first_payment_idx on public.salary_client_products(first_payment_date);
create index if not exists salary_payments_date_idx on public.salary_payments(payment_date);
create index if not exists salary_payments_client_idx on public.salary_payments(client_id);
create index if not exists salary_audit_created_idx on public.salary_audit(created_at desc);

alter table public.salary_clients enable row level security;
alter table public.salary_client_products enable row level security;
alter table public.salary_payments enable row level security;
alter table public.salary_department_months enable row level security;
alter table public.salary_config enable row level security;
alter table public.salary_audit enable row level security;

revoke all on public.salary_clients, public.salary_client_products, public.salary_payments, public.salary_department_months, public.salary_config, public.salary_audit from anon, authenticated;
grant select, insert, update, delete on public.salary_clients, public.salary_client_products, public.salary_payments, public.salary_department_months, public.salary_config to authenticated;
grant select on public.salary_audit to authenticated;

drop policy if exists "salary_clients_select" on public.salary_clients;
create policy "salary_clients_select" on public.salary_clients for select to authenticated
using (
  public.is_manager()
  or (public.is_active_user() and contractor_id = auth.uid())
);
drop policy if exists "salary_clients_manager_insert" on public.salary_clients;
create policy "salary_clients_manager_insert" on public.salary_clients for insert to authenticated
with check (public.is_manager());
drop policy if exists "salary_clients_manager_update" on public.salary_clients;
create policy "salary_clients_manager_update" on public.salary_clients for update to authenticated
using (public.is_manager()) with check (public.is_manager());
drop policy if exists "salary_clients_manager_delete" on public.salary_clients;
create policy "salary_clients_manager_delete" on public.salary_clients for delete to authenticated
using (public.is_manager());

drop policy if exists "salary_products_select" on public.salary_client_products;
create policy "salary_products_select" on public.salary_client_products for select to authenticated
using (
  public.is_manager()
  or (
    public.is_active_user()
    and exists (
      select 1 from public.salary_clients c
      where c.id = salary_client_products.client_id
        and c.contractor_id = auth.uid()
    )
  )
);
drop policy if exists "salary_products_manager_insert" on public.salary_client_products;
create policy "salary_products_manager_insert" on public.salary_client_products for insert to authenticated
with check (public.is_manager());
drop policy if exists "salary_products_manager_update" on public.salary_client_products;
create policy "salary_products_manager_update" on public.salary_client_products for update to authenticated
using (public.is_manager()) with check (public.is_manager());
drop policy if exists "salary_products_manager_delete" on public.salary_client_products;
create policy "salary_products_manager_delete" on public.salary_client_products for delete to authenticated
using (public.is_manager());

drop policy if exists "salary_payments_select" on public.salary_payments;
create policy "salary_payments_select" on public.salary_payments for select to authenticated
using (
  public.is_manager()
  or (
    public.is_active_user()
    and exists (
      select 1 from public.salary_clients c
      where c.id = salary_payments.client_id
        and c.contractor_id = auth.uid()
    )
  )
);
drop policy if exists "salary_payments_manager_insert" on public.salary_payments;
create policy "salary_payments_manager_insert" on public.salary_payments for insert to authenticated
with check (public.is_manager());
drop policy if exists "salary_payments_manager_update" on public.salary_payments;
create policy "salary_payments_manager_update" on public.salary_payments for update to authenticated
using (public.is_manager()) with check (public.is_manager());
drop policy if exists "salary_payments_manager_delete" on public.salary_payments;
create policy "salary_payments_manager_delete" on public.salary_payments for delete to authenticated
using (public.is_manager());

drop policy if exists "salary_months_select" on public.salary_department_months;
create policy "salary_months_select" on public.salary_department_months for select to authenticated
using (public.is_active_user());
drop policy if exists "salary_months_manager_insert" on public.salary_department_months;
create policy "salary_months_manager_insert" on public.salary_department_months for insert to authenticated
with check (public.is_manager());
drop policy if exists "salary_months_manager_update" on public.salary_department_months;
create policy "salary_months_manager_update" on public.salary_department_months for update to authenticated
using (public.is_manager()) with check (public.is_manager());
drop policy if exists "salary_months_manager_delete" on public.salary_department_months;
create policy "salary_months_manager_delete" on public.salary_department_months for delete to authenticated
using (public.is_manager());

drop policy if exists "salary_config_select" on public.salary_config;
create policy "salary_config_select" on public.salary_config for select to authenticated
using (public.is_active_user());
drop policy if exists "salary_config_manager_insert" on public.salary_config;
create policy "salary_config_manager_insert" on public.salary_config for insert to authenticated
with check (public.is_manager());
drop policy if exists "salary_config_manager_update" on public.salary_config;
create policy "salary_config_manager_update" on public.salary_config for update to authenticated
using (public.is_manager()) with check (public.is_manager());

drop policy if exists "salary_audit_manager_select" on public.salary_audit;
create policy "salary_audit_manager_select" on public.salary_audit for select to authenticated
using (public.is_manager());

create or replace function public.salary_audit_trigger()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_id text;
begin
  if tg_op = 'DELETE' then v_id := old.id::text; else v_id := new.id::text; end if;
  insert into public.salary_audit(entity_type,entity_id,action,old_data,new_data,actor_id)
  values(
    tg_table_name,
    v_id,
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    auth.uid()
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists salary_config_audit on public.salary_config;
create trigger salary_config_audit after insert or update on public.salary_config
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_clients_audit on public.salary_clients;
create trigger salary_clients_audit after insert or update or delete on public.salary_clients
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_products_audit on public.salary_client_products;
create trigger salary_products_audit after insert or update or delete on public.salary_client_products
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_payments_audit on public.salary_payments;
create trigger salary_payments_audit after insert or update or delete on public.salary_payments
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_months_audit on public.salary_department_months;
create trigger salary_months_audit after insert or update or delete on public.salary_department_months
for each row execute procedure public.salary_audit_trigger();
