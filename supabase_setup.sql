-- CampBox Sales Board — Supabase setup
-- Выполнить целиком в Supabase SQL Editor.
-- После этого зарегистрируй свой аккаунт через index.html и выполни
-- последний UPDATE внизу, подставив свой email, чтобы сделать себя руководителем.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'employee' check (role in ('manager','employee')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.month_settings (
  month date primary key,
  owner text default '',
  min_plan integer not null default 5 check (min_plan >= 0),
  target_plan integer not null default 10 check (target_plan >= 0),
  max_plan integer not null default 15 check (max_plan >= 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.day_settings (
  report_date date primary key,
  day_summary text default '',
  focus1 text default '',
  focus2 text default '',
  focus3 text default '',
  result_text text default '',
  blockers_text text default '',
  tomorrow_text text default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_sales (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  calls_plan integer not null default 0 check (calls_plan >= 0),
  calls_fact integer not null default 0 check (calls_fact >= 0),
  booked_plan integer not null default 0 check (booked_plan >= 0),
  booked_fact integer not null default 0 check (booked_fact >= 0),
  meetings_plan integer not null default 0 check (meetings_plan >= 0),
  meetings_fact integer not null default 0 check (meetings_fact >= 0),
  offers_plan integer not null default 0 check (offers_plan >= 0),
  offers_fact integer not null default 0 check (offers_fact >= 0),
  follow_plan integer not null default 0 check (follow_plan >= 0),
  follow_fact integer not null default 0 check (follow_fact >= 0),
  connected_plan integer not null default 0 check (connected_plan >= 0),
  connected_fact integer not null default 0 check (connected_fact >= 0),
  comment text default '',
  updated_at timestamptz not null default now(),
  unique(report_date,user_id)
);

create table if not exists public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  checkpoint_date date not null,
  plan integer not null default 0 check (plan >= 0),
  fact integer not null default 0 check (fact >= 0),
  comment text default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists daily_sales_report_date_idx on public.daily_sales(report_date);
create index if not exists daily_sales_user_id_idx on public.daily_sales(user_id);
create index if not exists checkpoints_month_idx on public.checkpoints(month);

-- Автоматически создаём профиль после регистрации. По умолчанию доступ ВЫКЛЮЧЕН.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id,email,full_name,role,active)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),'employee',false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Вспомогательные функции для RLS.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.active = true);
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role = 'manager');
$$;

alter table public.profiles enable row level security;
alter table public.month_settings enable row level security;
alter table public.day_settings enable row level security;
alter table public.daily_sales enable row level security;
alter table public.checkpoints enable row level security;

revoke all on public.profiles, public.month_settings, public.day_settings, public.daily_sales, public.checkpoints from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.month_settings, public.day_settings, public.daily_sales, public.checkpoints to authenticated;

-- PROFILES
create policy "profiles_select" on public.profiles for select to authenticated
using (id = auth.uid() or (public.is_active_user() and active = true) or public.is_manager());

create policy "profiles_manager_update" on public.profiles for update to authenticated
using (public.is_manager())
with check (public.is_manager());

-- MONTH SETTINGS: активные видят; редактирует только руководитель.
create policy "month_select" on public.month_settings for select to authenticated
using (public.is_active_user());
create policy "month_insert_manager" on public.month_settings for insert to authenticated
with check (public.is_manager());
create policy "month_update_manager" on public.month_settings for update to authenticated
using (public.is_manager()) with check (public.is_manager());
create policy "month_delete_manager" on public.month_settings for delete to authenticated
using (public.is_manager());

-- DAY SETTINGS: активные видят; редактирует только руководитель.
create policy "day_select" on public.day_settings for select to authenticated
using (public.is_active_user());
create policy "day_insert_manager" on public.day_settings for insert to authenticated
with check (public.is_manager());
create policy "day_update_manager" on public.day_settings for update to authenticated
using (public.is_manager()) with check (public.is_manager());
create policy "day_delete_manager" on public.day_settings for delete to authenticated
using (public.is_manager());

-- DAILY SALES
-- Руководитель видит все месяцы. Сотрудник — только текущий календарный месяц.
create policy "sales_select" on public.daily_sales for select to authenticated
using (
  public.is_manager()
  or (
    public.is_active_user()
    and report_date >= date_trunc('month', current_date)::date
    and report_date < (date_trunc('month', current_date) + interval '1 month')::date
  )
);

-- Сотрудник создаёт/меняет только свою строку текущего месяца. Руководитель — любую.
create policy "sales_insert" on public.daily_sales for insert to authenticated
with check (
  public.is_manager()
  or (
    public.is_active_user()
    and user_id = auth.uid()
    and report_date >= date_trunc('month', current_date)::date
    and report_date < (date_trunc('month', current_date) + interval '1 month')::date
  )
);
create policy "sales_update" on public.daily_sales for update to authenticated
using (
  public.is_manager()
  or (public.is_active_user() and user_id = auth.uid())
)
with check (
  public.is_manager()
  or (
    public.is_active_user()
    and user_id = auth.uid()
    and report_date >= date_trunc('month', current_date)::date
    and report_date < (date_trunc('month', current_date) + interval '1 month')::date
  )
);
create policy "sales_delete_manager" on public.daily_sales for delete to authenticated
using (public.is_manager());

-- CHECKPOINTS: руководитель видит все месяцы; сотрудник только текущий.
create policy "checkpoints_select" on public.checkpoints for select to authenticated
using (
  public.is_manager()
  or (
    public.is_active_user()
    and month = date_trunc('month', current_date)::date
  )
);
create policy "checkpoints_insert_manager" on public.checkpoints for insert to authenticated
with check (public.is_manager());
create policy "checkpoints_update_manager" on public.checkpoints for update to authenticated
using (public.is_manager()) with check (public.is_manager());
create policy "checkpoints_delete_manager" on public.checkpoints for delete to authenticated
using (public.is_manager());

-- ВАЖНО: после регистрации своего аккаунта выполни эту строку,
-- заменив адрес на СВОЮ почту. Это сделает тебя руководителем и активирует доступ.
-- update public.profiles set role='manager', active=true where email='YOUR_EMAIL@example.com';


-- ============================================================
-- Salary V1
-- ============================================================

-- CampBox Sales Board — Salary V1 / Contract Cycles migration
-- Выполнить целиком в Supabase SQL Editor.
-- Скрипт идемпотентен и безопасен для повторного запуска:
-- существующая история сохраняется, старые записи получают первый договорный цикл.

create extension if not exists pgcrypto;

-- ============================================================
-- Базовые сущности
-- ============================================================

create table if not exists public.salary_clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  -- legacy-поля оставлены для совместимости со старой Salary V1.
  contractor_id uuid references public.profiles(id) on delete set null,
  signed_date date,
  notes text default '',
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Клиент постоянный, договорных циклов у него может быть несколько.
create table if not exists public.salary_contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.salary_clients(id) on delete cascade,
  contractor_id uuid references public.profiles(id) on delete set null,
  signed_date date,
  status text not null default 'active'
    check (status in ('active','paused','terminated')),
  terminated_date date,
  termination_reason text default '',
  notes text default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (terminated_date is null or signed_date is null or terminated_date >= signed_date)
);

-- История пауз нужна отдельно: пауз может быть несколько,
-- и каждая продлевает 12-месячный мотивационный период.
create table if not exists public.salary_contract_pauses (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.salary_contracts(id) on delete cascade,
  pause_start date not null,
  pause_until date not null,
  resumed_at date,
  reason text default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pause_until >= pause_start),
  check (resumed_at is null or resumed_at >= pause_start)
);

create table if not exists public.salary_client_products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.salary_clients(id) on delete cascade,
  contract_id uuid references public.salary_contracts(id) on delete cascade,
  product_type text not null check (product_type in (
    'campbox','order_management','comfort_booking','maps','site','site_support'
  )),
  first_payment_date date,
  active boolean not null default true,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.salary_client_products
  add column if not exists contract_id uuid references public.salary_contracts(id) on delete cascade;

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  payment_date date not null,
  client_id uuid not null references public.salary_clients(id) on delete cascade,
  contract_id uuid references public.salary_contracts(id) on delete cascade,
  product_type text not null check (product_type in (
    'campbox','order_management','comfort_booking','maps','site','site_support'
  )),
  event_type text not null default 'payment'
    check (event_type in ('payment','site_live')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  payment_number integer check (payment_number is null or payment_number > 0),
  external_ref text default '',
  status text not null default 'confirmed'
    check (status in ('preliminary','confirmed','paid','excluded')),
  comment text default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.salary_payments
  add column if not exists contract_id uuid references public.salary_contracts(id) on delete cascade;

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

alter table public.salary_config
  add column if not exists vat_rate numeric(6,2) not null default 22;

insert into public.salary_config(id,vat_rate)
values(1,22)
on conflict (id) do nothing;

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

alter table public.salary_audit
  alter column entity_id type text using entity_id::text;

-- ============================================================
-- Перенос текущей Salary V1 в договорные циклы
-- ============================================================

-- Для каждого существующего клиента создаём первый договорный цикл,
-- если его ещё нет. Ничего из старой истории не удаляется.
insert into public.salary_contracts (
  client_id, contractor_id, signed_date, status, created_by, created_at, updated_at
)
select
  c.id,
  c.contractor_id,
  c.signed_date,
  case when c.active then 'active' else 'terminated' end,
  c.created_by,
  c.created_at,
  c.updated_at
from public.salary_clients c
where not exists (
  select 1 from public.salary_contracts sc where sc.client_id = c.id
);

-- Привязываем старые направления к первому договорному циклу.
update public.salary_client_products p
set contract_id = (
  select sc.id
  from public.salary_contracts sc
  where sc.client_id = p.client_id
  order by sc.created_at asc, sc.id asc
  limit 1
)
where p.contract_id is null;

-- Привязываем старые поступления к первому договорному циклу.
update public.salary_payments p
set contract_id = (
  select sc.id
  from public.salary_contracts sc
  where sc.client_id = p.client_id
  order by sc.created_at asc, sc.id asc
  limit 1
)
where p.contract_id is null;

-- Старое ограничение client + product мешает повторному договору
-- того же клиента. Теперь уникальность действует внутри договора.
alter table public.salary_client_products
  drop constraint if exists salary_client_products_client_id_product_type_key;

drop index if exists public.salary_products_contract_type_uidx;
create unique index salary_products_contract_type_uidx
  on public.salary_client_products(contract_id, product_type);

-- Одна незакрытая пауза на один договор.
create unique index if not exists salary_contract_one_open_pause_uidx
  on public.salary_contract_pauses(contract_id)
  where resumed_at is null;

-- ============================================================
-- Индексы
-- ============================================================

create index if not exists salary_clients_contractor_idx
  on public.salary_clients(contractor_id);
create index if not exists salary_clients_signed_date_idx
  on public.salary_clients(signed_date);
create index if not exists salary_contracts_client_idx
  on public.salary_contracts(client_id);
create index if not exists salary_contracts_contractor_idx
  on public.salary_contracts(contractor_id);
create index if not exists salary_contracts_signed_idx
  on public.salary_contracts(signed_date);
create index if not exists salary_contracts_status_idx
  on public.salary_contracts(status);
create index if not exists salary_pauses_contract_idx
  on public.salary_contract_pauses(contract_id);
create index if not exists salary_products_client_idx
  on public.salary_client_products(client_id);
create index if not exists salary_products_contract_idx
  on public.salary_client_products(contract_id);
create index if not exists salary_products_first_payment_idx
  on public.salary_client_products(first_payment_date);
create index if not exists salary_payments_date_idx
  on public.salary_payments(payment_date);
create index if not exists salary_payments_client_idx
  on public.salary_payments(client_id);
create index if not exists salary_payments_contract_idx
  on public.salary_payments(contract_id);
create index if not exists salary_audit_created_idx
  on public.salary_audit(created_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.salary_clients enable row level security;
alter table public.salary_contracts enable row level security;
alter table public.salary_contract_pauses enable row level security;
alter table public.salary_client_products enable row level security;
alter table public.salary_payments enable row level security;
alter table public.salary_department_months enable row level security;
alter table public.salary_config enable row level security;
alter table public.salary_audit enable row level security;

revoke all on
  public.salary_clients,
  public.salary_contracts,
  public.salary_contract_pauses,
  public.salary_client_products,
  public.salary_payments,
  public.salary_department_months,
  public.salary_config,
  public.salary_audit
from anon, authenticated;

grant select, insert, update, delete on
  public.salary_clients,
  public.salary_contracts,
  public.salary_contract_pauses,
  public.salary_client_products,
  public.salary_payments,
  public.salary_department_months,
  public.salary_config
to authenticated;

grant select on public.salary_audit to authenticated;

-- Клиент виден сотруднику, если у него есть хотя бы один договорный цикл.
drop policy if exists "salary_clients_select" on public.salary_clients;
create policy "salary_clients_select" on public.salary_clients
for select to authenticated
using (
  public.is_manager()
  or (
    public.is_active_user()
    and exists (
      select 1 from public.salary_contracts sc
      where sc.client_id = salary_clients.id
        and sc.contractor_id = auth.uid()
    )
  )
);

drop policy if exists "salary_clients_manager_insert" on public.salary_clients;
create policy "salary_clients_manager_insert" on public.salary_clients
for insert to authenticated with check (public.is_manager());

drop policy if exists "salary_clients_manager_update" on public.salary_clients;
create policy "salary_clients_manager_update" on public.salary_clients
for update to authenticated
using (public.is_manager()) with check (public.is_manager());

drop policy if exists "salary_clients_manager_delete" on public.salary_clients;
create policy "salary_clients_manager_delete" on public.salary_clients
for delete to authenticated using (public.is_manager());

-- Договорные циклы.
drop policy if exists "salary_contracts_select" on public.salary_contracts;
create policy "salary_contracts_select" on public.salary_contracts
for select to authenticated
using (
  public.is_manager()
  or (public.is_active_user() and contractor_id = auth.uid())
);

drop policy if exists "salary_contracts_manager_insert" on public.salary_contracts;
create policy "salary_contracts_manager_insert" on public.salary_contracts
for insert to authenticated with check (public.is_manager());

drop policy if exists "salary_contracts_manager_update" on public.salary_contracts;
create policy "salary_contracts_manager_update" on public.salary_contracts
for update to authenticated
using (public.is_manager()) with check (public.is_manager());

drop policy if exists "salary_contracts_manager_delete" on public.salary_contracts;
create policy "salary_contracts_manager_delete" on public.salary_contracts
for delete to authenticated using (public.is_manager());

-- Паузы видны менеджеру своего договора, меняет только руководитель.
drop policy if exists "salary_pauses_select" on public.salary_contract_pauses;
create policy "salary_pauses_select" on public.salary_contract_pauses
for select to authenticated
using (
  public.is_manager()
  or (
    public.is_active_user()
    and exists (
      select 1 from public.salary_contracts sc
      where sc.id = salary_contract_pauses.contract_id
        and sc.contractor_id = auth.uid()
    )
  )
);

drop policy if exists "salary_pauses_manager_insert" on public.salary_contract_pauses;
create policy "salary_pauses_manager_insert" on public.salary_contract_pauses
for insert to authenticated with check (public.is_manager());

drop policy if exists "salary_pauses_manager_update" on public.salary_contract_pauses;
create policy "salary_pauses_manager_update" on public.salary_contract_pauses
for update to authenticated
using (public.is_manager()) with check (public.is_manager());

drop policy if exists "salary_pauses_manager_delete" on public.salary_contract_pauses;
create policy "salary_pauses_manager_delete" on public.salary_contract_pauses
for delete to authenticated using (public.is_manager());

-- Направления.
drop policy if exists "salary_products_select" on public.salary_client_products;
create policy "salary_products_select" on public.salary_client_products
for select to authenticated
using (
  public.is_manager()
  or (
    public.is_active_user()
    and exists (
      select 1 from public.salary_contracts sc
      where sc.id = salary_client_products.contract_id
        and sc.contractor_id = auth.uid()
    )
  )
);

drop policy if exists "salary_products_manager_insert" on public.salary_client_products;
create policy "salary_products_manager_insert" on public.salary_client_products
for insert to authenticated with check (public.is_manager());

drop policy if exists "salary_products_manager_update" on public.salary_client_products;
create policy "salary_products_manager_update" on public.salary_client_products
for update to authenticated
using (public.is_manager()) with check (public.is_manager());

drop policy if exists "salary_products_manager_delete" on public.salary_client_products;
create policy "salary_products_manager_delete" on public.salary_client_products
for delete to authenticated using (public.is_manager());

-- Поступления.
drop policy if exists "salary_payments_select" on public.salary_payments;
create policy "salary_payments_select" on public.salary_payments
for select to authenticated
using (
  public.is_manager()
  or (
    public.is_active_user()
    and exists (
      select 1 from public.salary_contracts sc
      where sc.id = salary_payments.contract_id
        and sc.contractor_id = auth.uid()
    )
  )
);

drop policy if exists "salary_payments_manager_insert" on public.salary_payments;
create policy "salary_payments_manager_insert" on public.salary_payments
for insert to authenticated with check (public.is_manager());

drop policy if exists "salary_payments_manager_update" on public.salary_payments;
create policy "salary_payments_manager_update" on public.salary_payments
for update to authenticated
using (public.is_manager()) with check (public.is_manager());

drop policy if exists "salary_payments_manager_delete" on public.salary_payments;
create policy "salary_payments_manager_delete" on public.salary_payments
for delete to authenticated using (public.is_manager());

-- Месячные настройки.
drop policy if exists "salary_months_select" on public.salary_department_months;
create policy "salary_months_select" on public.salary_department_months
for select to authenticated using (public.is_active_user());

drop policy if exists "salary_months_manager_insert" on public.salary_department_months;
create policy "salary_months_manager_insert" on public.salary_department_months
for insert to authenticated with check (public.is_manager());

drop policy if exists "salary_months_manager_update" on public.salary_department_months;
create policy "salary_months_manager_update" on public.salary_department_months
for update to authenticated
using (public.is_manager()) with check (public.is_manager());

drop policy if exists "salary_months_manager_delete" on public.salary_department_months;
create policy "salary_months_manager_delete" on public.salary_department_months
for delete to authenticated using (public.is_manager());

-- Конфиг.
drop policy if exists "salary_config_select" on public.salary_config;
create policy "salary_config_select" on public.salary_config
for select to authenticated using (public.is_active_user());

drop policy if exists "salary_config_manager_insert" on public.salary_config;
create policy "salary_config_manager_insert" on public.salary_config
for insert to authenticated with check (public.is_manager());

drop policy if exists "salary_config_manager_update" on public.salary_config;
create policy "salary_config_manager_update" on public.salary_config
for update to authenticated
using (public.is_manager()) with check (public.is_manager());

-- Аудит.
drop policy if exists "salary_audit_manager_select" on public.salary_audit;
create policy "salary_audit_manager_select" on public.salary_audit
for select to authenticated using (public.is_manager());

-- ============================================================
-- Аудит изменений
-- ============================================================

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
create trigger salary_config_audit
after insert or update on public.salary_config
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_clients_audit on public.salary_clients;
create trigger salary_clients_audit
after insert or update or delete on public.salary_clients
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_contracts_audit on public.salary_contracts;
create trigger salary_contracts_audit
after insert or update or delete on public.salary_contracts
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_pauses_audit on public.salary_contract_pauses;
create trigger salary_pauses_audit
after insert or update or delete on public.salary_contract_pauses
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_products_audit on public.salary_client_products;
create trigger salary_products_audit
after insert or update or delete on public.salary_client_products
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_payments_audit on public.salary_payments;
create trigger salary_payments_audit
after insert or update or delete on public.salary_payments
for each row execute procedure public.salary_audit_trigger();

drop trigger if exists salary_months_audit on public.salary_department_months;
create trigger salary_months_audit
after insert or update or delete on public.salary_department_months
for each row execute procedure public.salary_audit_trigger();
