-- Disposable PostgreSQL 17 integration fixture, NO Supabase connection, no credentials.
\set ON_ERROR_STOP on
create schema auth;
create schema campbox_internal;
do $r$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end$r$;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key,role text not null,active boolean not null);
grant select on public.profiles to authenticated;
create function public.is_manager() returns boolean language sql stable as
$$select exists(select 1 from public.profiles where id=auth.uid() and role='manager' and active)$$;
create function public.is_active_user() returns boolean language sql stable as
$$select exists(select 1 from public.profiles where id=auth.uid() and active)$$;
create table public.daily_sales (
 id uuid primary key default gen_random_uuid(),report_date date not null,
 user_id uuid not null,comment text
);
create table public.salary_clients (
 id uuid primary key default gen_random_uuid(),client_name text not null,
 contractor_id uuid,signed_date date,active boolean not null default true,
 created_by uuid,updated_at timestamptz default now()
);
create table public.csm_camps (
 id uuid primary key default gen_random_uuid(),name text not null,
 sales_client_id uuid unique,responsible_id uuid,active boolean default true
);
create function campbox_internal.apply_salary_client(p_id uuid,p_name text,p_active boolean)
returns void language plpgsql security definer set search_path='' as $f$
begin
 insert into public.csm_camps(name,sales_client_id,active)
 values(p_name,p_id,p_active)
 on conflict(sales_client_id) do update
 set name=excluded.name,active=excluded.active;
end;
$f$;
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.profiles values
 ('11111111-1111-4111-8111-111111111111','employee',true),
 ('22222222-2222-4222-8222-222222222222','employee',true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
\i migration_2026-10-14_sales_signed_to_csm.sql

-- Signing not yet complete => no client created.
insert into public.daily_sales(report_date,user_id,comment) values(
 '2026-10-14','11111111-1111-4111-8111-111111111111',
 '{"__type":"daily_reflection","contracts":[{"id":"deal-a","client":"Лагерь Солнечный","status":"signing"}]}'
);
do $$ begin
 if (select count(*) from public.salary_clients) <> 0 then
   raise exception 'Unsigned created Sales client';end if;
end $$;

-- Confirm signature => one client, one CSM record.
update public.daily_sales set comment=
 '{"__type":"daily_reflection","contracts":[{"id":"deal-a","client":"Лагерь Солнечный","status":"signed","signed_date":"2026-10-14"}]}';
do $$ begin
 if (select count(*) from public.salary_clients) <> 1 then raise exception 'No Sales client';end if;
 if (select count(*) from public.csm_camps) <> 1 then raise exception 'No CSM camp';end if;
 if (select count(*) from public.sales_handoff_statuses where state='linked' and not assigned) <> 1
   then raise exception 'Handoff not queued';end if;
end $$;

-- Repeated save => still exactly one client.
update public.daily_sales set comment=comment;
do $$begin
 if (select count(*) from public.salary_clients) <> 1 then raise exception 'Repeated save duplicate';end if;
 if (select count(*) from public.csm_camps) <> 1 then raise exception 'Repeated CSM duplicate';end if;
end $$;

-- Assign CSM: public RLS status must now be assigned.
update public.csm_camps set responsible_id='22222222-2222-4222-8222-222222222222';
do $$begin
 if (select count(*) from public.sales_handoff_statuses where contract_key='deal-a' and assigned)<>1
 then raise exception 'Assignment did not propagate';end if;
end $$;

-- Name collision: do not attach to arbitrarily chosen client.
insert into public.salary_clients(client_name,active)
values ('Альфа',true),('АЛЬФА ',true);
insert into public.daily_sales(report_date,user_id,comment) values(
 '2026-10-15','11111111-1111-4111-8111-111111111111',
 '{"__type":"daily_reflection","contracts":[{"id":"deal-b","client":"Альфа","status":"signed","signed_date":"2026-10-15"}]}'
);
do $$begin
 if (select state from public.sales_handoff_statuses where contract_key='deal-b') <> 'conflict'
 then raise exception 'Ambiguous name was silently merged';end if;
 if (select count(*) from public.salary_clients)<>3 then raise exception 'Name conflict created a duplicate';end if;
end $$;

-- Lost deal => never added.
insert into public.daily_sales(report_date,user_id,comment) values(
 '2026-10-16','11111111-1111-4111-8111-111111111111',
 '{"__type":"daily_reflection","contracts":[{"id":"deal-c","client":"Нет договора","status":"lost"}]}'
);
do $$begin
 if (select count(*) from public.salary_clients)<>3 then raise exception 'Lost deal transferred';end if;
end $$;

-- Employee must not see other users' handoff status (public table has RLS).
insert into public.sales_handoff_statuses(sales_user_id,contract_key,state)
values('22222222-2222-4222-8222-222222222222','foreign','linked');
set role authenticated;
do $$ begin
 if (select count(*) from public.sales_handoff_statuses) <> 2
 then raise exception 'RLS leaked colleagues handoff rows';end if;
end $$;
reset role;
select 'ALL_POSTGRES_INTEGRATION_TESTS_PASSED' as result;
