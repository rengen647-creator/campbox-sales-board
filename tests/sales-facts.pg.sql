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


\i sql/signed-facts.sql

insert into public.sales_fact_periods(month,closed,reconciled) values('2026-09-01',false,false),('2026-10-01',false,false);
update profiles set role='manager' where id='22222222-2222-4222-8222-222222222222';
create table salary_contracts(id uuid primary key default gen_random_uuid());
insert into daily_sales(report_date,user_id,comment) values('2026-10-28',auth.uid(),'{"__type":"daily_reflection","contracts":[{"id":"one","client":"Camp One","status":"signed","signed_date":"2026-10-28","contract_number":"SHARED","document_key":"document-1"},{"id":"two","client":"Camp Two","status":"signed","signed_date":"2026-10-28","contract_number":"SHARED","document_key":"document-1"}]}');
do $$begin
 if (select count(*) from sales_signed_events)<>2 then raise exception 'Two camps sharing document must count twice';end if;
 if (select count(*) from salary_contracts)<>0 then raise exception 'Salary cycles created';end if;
end$$;
update daily_sales set comment=comment where report_date='2026-10-28';
do $$begin if (select count(*) from sales_signed_events)<>2 or (select count(*) from sales_fact_audit)<>2 then raise exception 'Repeat not idempotent';end if;end$$;
-- Cross-period change, with optimistic revision and correction reason.
update daily_sales set comment=jsonb_set(jsonb_set(jsonb_set(comment::jsonb,'{contracts,0,signed_date}','"2026-09-30"'),'{contracts,0,event_revision}','1'),'{contracts,0,correction_reason}','"Correct actual signature date"')::text where report_date='2026-10-28';
do $$begin if (select count(*) from sales_signed_events where signed_date='2026-09-30')<>1 or (select count(*) from sales_signed_events where signed_date='2026-10-28')<>1 then raise exception 'Date move wrong';end if;end$$;
-- Termination retains sale and date.
update daily_sales set comment=jsonb_set(jsonb_set(comment::jsonb,'{contracts,0,status}','"terminated"'),'{contracts,0,event_revision}','2')::text where report_date='2026-10-28';
do $$begin if (select count(*) from sales_signed_events where state='confirmed')<>2 then raise exception 'Termination erased history';end if;end$$;
update sales_fact_periods set closed=true where month='2026-09-01';
do $$begin
 begin
  update daily_sales set comment=jsonb_set(jsonb_set(jsonb_set(comment::jsonb,'{contracts,0,status}','"signed"'),'{contracts,0,signed_date}','"2026-10-01"'),'{contracts,0,event_revision}','3')::text where report_date='2026-10-28';
  raise exception 'FAIL closed correction accepted';
 exception when others then if sqlerrm like 'FAIL%' then raise;end if;end;
end$$;
-- Authenticated direct mutation is forbidden; foreign event read returns no rows.
set role authenticated;
do $$begin
 begin update public.sales_signed_events set signed_date='2026-10-02';raise exception 'FAIL direct update allowed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$begin if (select count(*) from sales_signed_events)<>2 then raise exception 'Manager cannot read team';end if;end$$;
reset role;
update profiles set role='employee' where id='22222222-2222-4222-8222-222222222222';
set role authenticated;
do $$begin if (select count(*) from sales_signed_events)<>0 then raise exception 'Foreign event leak';end if;end$$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
-- Force a CSM-side failure; signing persists with explicit handoff error.
create or replace function campbox_internal.apply_salary_client(p_id uuid,p_name text,p_active boolean) returns void language plpgsql as $$begin raise exception 'Synthetic CSM outage';end$$;
insert into daily_sales(report_date,user_id,comment) values('2026-10-27',auth.uid(),'{"__type":"daily_reflection","contracts":[{"id":"outage","client":"Outage Camp","status":"signed","signed_date":"2026-10-27","contract_number":"X"}]}');
do $$begin
 if not exists(select 1 from sales_signed_events where contract_key='outage') then raise exception 'CSM failure erased sale';end if;
 if not exists(select 1 from sales_handoff_statuses where contract_key='outage' and state='error') then raise exception 'CSM failure not visible';end if;
end$$;
select 'PASS signed registry, cross-month correction, idempotency, common document, termination, closed period, role boundaries, CSM outage and no salary writes';

-- Explicit void is manager-only, audited, revision guarded and period guarded.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
set role authenticated;
do $$begin
 begin perform public.void_sales_signed_event('00000000-0000-4000-8000-000000000000',1,'Testing employee restriction');raise exception 'FAIL employee correction allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
update profiles set role='manager' where id='22222222-2222-4222-8222-222222222222';
set role authenticated;
do $$declare e public.sales_signed_events%rowtype; begin
 select * into e from sales_signed_events where signed_date='2026-09-30';
 begin perform public.void_sales_signed_event(e.id,e.revision,'Wrong camp signed in September');raise exception 'FAIL closed void accepted';exception when others then if sqlerrm like 'FAIL%' then raise;end if;end;
 select * into e from sales_signed_events where contract_key='outage';
 begin perform public.void_sales_signed_event(e.id,0,'Wrong camp signed in October');raise exception 'FAIL stale void accepted';exception when serialization_failure then null;end;
 perform public.void_sales_signed_event(e.id,e.revision,'Wrong camp signed in October');
 if not exists(select 1 from sales_signed_events where id=e.id and state='void') then raise exception 'Void did not persist';end if;
 if not exists(select 1 from sales_fact_audit where contract_key=e.contract_key and after_value->>'state'='void' and actor_id=auth.uid()) then raise exception 'Void audit missing';end if;
end$$;
reset role;
-- Reviewed historical mapping: source drift rejected; repeat imports no extra fact.
\ir ../sql/approved-signed-backfill.sql
alter table public.daily_sales disable trigger ab_daily_sales_signed_fact;
insert into daily_sales(report_date,user_id,comment) values('2026-10-26','11111111-1111-4111-8111-111111111111','{"__type":"daily_reflection","contracts":[{"id":"legacy-approved","client":"Legacy Camp","status":"signed","signed_date":"2026-10-26","contract_number":"LEGACY-1"}]}');
alter table public.daily_sales enable trigger ab_daily_sales_signed_fact;
do $$declare m jsonb:='[{"sales_user_id":"11111111-1111-4111-8111-111111111111","contract_key":"legacy-approved","camp_name":"Legacy Camp","signed_date":"2026-10-26","contract_number":"LEGACY-1"}]';n integer; begin
 begin perform pg_temp.import_approved_signed_facts(jsonb_set(m,'{0,signed_date}','"2026-10-25"'),'22222222-2222-4222-8222-222222222222');raise exception 'FAIL changed source accepted';exception when others then if sqlerrm like 'FAIL%' then raise;end if;end;
 n:=pg_temp.import_approved_signed_facts(m,'22222222-2222-4222-8222-222222222222');if n<>1 then raise exception 'Import count wrong';end if;
 n:=pg_temp.import_approved_signed_facts(m,'22222222-2222-4222-8222-222222222222');if n<>0 then raise exception 'Repeat imported twice';end if;
 if (select count(*) from salary_contracts)<>0 then raise exception 'Backfill created salary cycle';end if;
end$$;
