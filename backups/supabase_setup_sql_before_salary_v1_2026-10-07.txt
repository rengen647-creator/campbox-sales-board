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
