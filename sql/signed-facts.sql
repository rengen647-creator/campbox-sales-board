-- STAGING / RELEASE INPUT. No backfill. Generate the final migration with the CLI
-- after staging validation. Requires the existing 2026-10-14 handoff migration.
begin;
create table public.sales_camp_registry (
 id uuid primary key default gen_random_uuid(), sales_user_id uuid not null references public.profiles(id),
 name text not null check(length(btrim(name)) between 1 and 200), created_at timestamptz not null default now()
);
create table public.sales_deal_registry (
 sales_user_id uuid not null references public.profiles(id), contract_key text not null check(length(contract_key) between 1 and 128),
 camp_id uuid not null references public.sales_camp_registry(id), document_key text not null,
 contract_number text not null default '', status text not null check(status in ('signing','signed','lost','terminated')),
 signed_date date, sent_date date, target_date date, next_contact date, next_action text not null default '',
 blocker text not null default '', ball text not null default 'client', revision integer not null default 1,
 source_report_date date not null, updated_at timestamptz not null default now(), updated_by uuid not null references public.profiles(id),
 primary key(sales_user_id,contract_key)
);
create table public.sales_signed_events (
 id uuid primary key default gen_random_uuid(), sales_user_id uuid not null, contract_key text not null,
 camp_id uuid not null references public.sales_camp_registry(id), document_key text not null, contract_number text not null,
 signed_date date not null, state text not null default 'confirmed' check(state in ('confirmed','void')),
 recorded_at timestamptz not null default now(), recorded_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(), revision integer not null default 1,
 unique(sales_user_id,contract_key), foreign key(sales_user_id,contract_key) references public.sales_deal_registry,
 check(length(btrim(contract_number)) between 1 and 120)
);
create unique index sales_signed_camp_document on public.sales_signed_events(camp_id,document_key) where state='confirmed';
create index sales_signed_date_owner on public.sales_signed_events(signed_date,sales_user_id);
create table public.sales_fact_audit (
 id bigint generated always as identity primary key, sales_user_id uuid not null, contract_key text not null,
 actor_id uuid not null references public.profiles(id), changed_at timestamptz not null default now(),
 reason text not null, before_value jsonb, after_value jsonb not null
);
create index sales_fact_audit_deal on public.sales_fact_audit(sales_user_id,contract_key,id);
create table public.sales_fact_periods (
 month date primary key check(extract(day from month)=1), closed boolean not null default true,
 reconciled boolean not null default false, approved_by uuid references public.profiles(id), approved_at timestamptz,
 check(not reconciled or (approved_by is not null and approved_at is not null))
);
-- Absence of a period is CLOSED, including the current month. Release must explicitly
-- open the chosen month after reconciliation approval. No historical totals are changed.
do $b$ declare t text; begin
 foreach t in array array['sales_camp_registry','sales_deal_registry','sales_signed_events','sales_fact_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy read_own_sales on public.%I for select to authenticated using ((select public.is_active_user()) and (sales_user_id=(select auth.uid()) or (select public.is_manager())))',t);
 end loop;
end $b$;
alter table public.sales_fact_periods enable row level security;
revoke all on public.sales_fact_periods from public,anon,authenticated;
grant select on public.sales_fact_periods to authenticated;
create policy read_periods on public.sales_fact_periods for select to authenticated using ((select public.is_active_user()));

create function campbox_internal.sales_fact_open(d date) returns boolean
language sql stable security definer set search_path='' as $f$
 select exists(select 1 from public.sales_fact_periods where month=date_trunc('month',d)::date and not closed);
$f$;
revoke all on function campbox_internal.sales_fact_open(date) from public,anon,authenticated;

create function campbox_internal.sync_sales_fact() returns trigger
language plpgsql security definer set search_path='' as $f$
declare doc jsonb; prevdoc jsonb; item jsonb; previtem jsonb; ky text; st text; nm text; no text; dk text; why text;
 dt date; cid uuid; existing public.sales_deal_registry%rowtype; ev public.sales_signed_events%rowtype;
 saved public.sales_deal_registry%rowtype; before_json jsonb; payload jsonb;
begin
 if new.comment is not distinct from old.comment and tg_op='UPDATE' then return new; end if;
 begin doc:=new.comment::jsonb; exception when others then return new; end;
 if doc->>'__type' is distinct from 'daily_reflection' or jsonb_typeof(doc->'contracts') is distinct from 'array' then return new; end if;
 if auth.uid() is null or not public.is_active_user() or (new.user_id<>auth.uid() and not public.is_manager()) then
  raise exception 'Sales ownership required' using errcode='42501';
 end if;
 begin prevdoc:=old.comment::jsonb; exception when others then prevdoc:='{}'::jsonb; end;
 if exists(select 1 from jsonb_array_elements(doc->'contracts') x group by x->>'id' having count(*)>1) then
  raise exception 'Duplicate deal ID' using errcode='23505';
 end if;
 for item in select value from jsonb_array_elements(doc->'contracts') loop
  ky:=btrim(coalesce(item->>'id','')); nm:=btrim(coalesce(item->>'client','')); st:=coalesce(item->>'status','signing');
  if ky='' or length(ky)>128 or nm='' or length(nm)>200 or st not in ('signing','signed','lost','terminated') then raise exception 'Invalid deal'; end if;
  perform pg_advisory_xact_lock(hashtext('sales-fact:'||new.user_id::text||':'||ky));
  select * into existing from public.sales_deal_registry where sales_user_id=new.user_id and contract_key=ky for update;
  select value into previtem from jsonb_array_elements(case when jsonb_typeof(prevdoc->'contracts')='array' then prevdoc->'contracts' else '[]'::jsonb end) where value->>'id'=ky;
  -- Ordinary daily activity saves must not silently backfill legacy signed rows.
  if existing.contract_key is null and previtem->>'status'='signed' then
   if (item-'event_revision'-'correction_reason') is distinct from (previtem-'event_revision'-'correction_reason') then raise exception 'Legacy signed deal requires approved reconciliation'; end if;
   continue;
  end if;
  no:=btrim(coalesce(item->>'contract_number','')); dk:=coalesce(nullif(item->>'document_key',''),new.user_id::text||':'||ky);
  dt:=nullif(item->>'signed_date','')::date; why:=btrim(coalesce(item->>'correction_reason',''));
  if st='signed' and (dt is null or no='' or length(no)>120 or dt>current_date) then raise exception 'Valid signing date and document number required'; end if;
  payload:=jsonb_build_object('contract_number',no,'status',st,'signed_date',dt,'sent_date',nullif(item->>'sent_date','')::date,'target_date',nullif(item->>'target_date','')::date,'next_contact',nullif(item->>'next_contact','')::date,'next_action',coalesce(item->>'next_action',''),'blocker',coalesce(item->>'blocker',''),'ball',coalesce(item->>'ball','client'),'document_key',dk);
  if existing.contract_key is not null then
   before_json:=to_jsonb(existing);
   if payload <@ before_json and nm=(select name from public.sales_camp_registry where id=existing.camp_id) then continue; end if;
   if coalesce((item->>'event_revision')::integer,0)<>existing.revision then raise exception 'Deal changed in another session. Reload before saving.' using errcode='40001'; end if;
   cid:=existing.camp_id;
  else
   before_json:=null;
   insert into public.sales_camp_registry(sales_user_id,name) values(new.user_id,nm) returning id into cid;
  end if;
  select * into ev from public.sales_signed_events where sales_user_id=new.user_id and contract_key=ky for update;
  if ev.id is not null and (dt is distinct from ev.signed_date or no is distinct from ev.contract_number or dk is distinct from ev.document_key or nm is distinct from (select name from public.sales_camp_registry where id=cid)) then
   if st<>'signed' then raise exception 'Signing corrections require signed status'; end if;
   if not campbox_internal.sales_fact_open(ev.signed_date) or not campbox_internal.sales_fact_open(dt) then raise exception 'Closed signing period: approved correction required'; end if;
   if length(why)<8 then raise exception 'Describe the correction reason (at least 8 characters)'; end if;
  end if;
  if st='signed' and ev.id is null and not campbox_internal.sales_fact_open(dt) then raise exception 'Signing period is closed or not approved'; end if;
  update public.sales_camp_registry set name=nm where id=cid;
  insert into public.sales_deal_registry(sales_user_id,contract_key,camp_id,document_key,contract_number,status,signed_date,sent_date,target_date,next_contact,next_action,blocker,ball,source_report_date,updated_by)
  values(new.user_id,ky,cid,dk,no,st,dt,(payload->>'sent_date')::date,(payload->>'target_date')::date,(payload->>'next_contact')::date,payload->>'next_action',payload->>'blocker',payload->>'ball',new.report_date,auth.uid())
  on conflict(sales_user_id,contract_key) do update set document_key=excluded.document_key,contract_number=excluded.contract_number,status=excluded.status,signed_date=excluded.signed_date,sent_date=excluded.sent_date,target_date=excluded.target_date,next_contact=excluded.next_contact,next_action=excluded.next_action,blocker=excluded.blocker,ball=excluded.ball,source_report_date=excluded.source_report_date,updated_by=auth.uid(),updated_at=now(),revision=sales_deal_registry.revision+1 returning * into saved;
  if st='signed' then
   insert into public.sales_signed_events(sales_user_id,contract_key,camp_id,document_key,contract_number,signed_date,recorded_by)
   values(new.user_id,ky,cid,dk,no,dt,auth.uid())
   on conflict(sales_user_id,contract_key) do update set signed_date=excluded.signed_date,contract_number=excluded.contract_number,document_key=excluded.document_key,updated_at=now(),revision=sales_signed_events.revision+1
   where (sales_signed_events.signed_date,sales_signed_events.contract_number,sales_signed_events.document_key) is distinct from (excluded.signed_date,excluded.contract_number,excluded.document_key);
  end if;
  -- lost / terminated / deleted source rows never erase a confirmed historical sale.
  insert into public.sales_fact_audit(sales_user_id,contract_key,actor_id,reason,before_value,after_value)
  values(new.user_id,ky,auth.uid(),coalesce(nullif(why,''),'Confirmed contract save'),before_json,to_jsonb(saved)||jsonb_build_object('camp_name',nm));
 end loop;
 return new;
end $f$;
revoke all on function campbox_internal.sync_sales_fact() from public,anon,authenticated;
-- Remove production-only coupling and number uniqueness; financial rows remain untouched.
drop trigger if exists aa_validate_signed_contract_number on public.daily_sales;
drop trigger if exists zz_daily_sales_signed_to_salary on public.daily_sales;
drop trigger if exists zzz_propagate_signed_contract_number on public.daily_sales;
create trigger ab_daily_sales_signed_fact after insert or update of comment on public.daily_sales for each row execute function campbox_internal.sync_sales_fact();
alter table public.sales_handoff_statuses drop constraint if exists sales_handoff_statuses_state_check;
alter table public.sales_handoff_statuses add constraint sales_handoff_statuses_state_check check(state in ('linked','conflict','error'));
create or replace function campbox_internal.sync_signed_deal()
returns trigger language plpgsql security definer set search_path=''
as $f$
declare
  doc jsonb;
  item jsonb;
  nm text;
  ky text;
  canon text;
  dt date;
  n integer;
  cid uuid;
  old_cid uuid;
  problem text;
begin
  if auth.uid() is null then return new; end if;
  if not exists (select 1 from public.profiles where id=auth.uid()
                 and active and role in ('employee','manager')) then
    raise exception 'Sales access required' using errcode='42501';
  end if;
  if new.user_id<>auth.uid() and not public.is_manager() then
    raise exception 'Cannot transfer another employee deal' using errcode='42501';
  end if;
  begin doc:=new.comment::jsonb;
  exception when others then return new; end;
  if doc->>'__type' is distinct from 'daily_reflection' or
     jsonb_typeof(doc->'contracts') is distinct from 'array' then return new; end if;
  for item in select value from jsonb_array_elements(doc->'contracts') loop
    if item->>'status' is distinct from 'signed' then continue; end if;
    begin
    nm:=btrim(coalesce(item->>'client',''));
    ky:=btrim(coalesce(item->>'id',''));
    if ky='' then continue; end if;
    if length(ky)>128 then continue; end if;
    problem:=''; cid:=null; dt:=null;
    if nm='' or length(nm)>200 then problem:='Некорректное название лагеря'; end if;
    begin
      if coalesce(item->>'signed_date','') !~ '^\d{4}-\d{2}-\d{2}$' then
        problem:='Нужна дата фактического подписания';
      else dt:=(item->>'signed_date')::date;
      end if;
    exception when others then problem:='Некорректная дата'; end;
    canon:=regexp_replace(lower(nm),'[^[:alnum:]]','','g');
    if canon='' then problem:='Некорректное название'; end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('signed-deal:'||new.user_id::text||':'||ky));
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('sales-csm:'||canon));
    select salary_client_id into old_cid
      from campbox_internal.sales_signed_handoffs
      where sales_user_id=new.user_id and contract_key=ky;
    if problem='' and old_cid is not null then
      select id into cid from public.salary_clients where id=old_cid
        and regexp_replace(lower(client_name),'[^[:alnum:]]','','g')=canon;
      if cid is null then problem:='Изменено имя уже переданного клиента'; end if;
    elsif problem='' then
      select count(*),(array_agg(id order by id))[1] into n,cid from public.salary_clients
      where regexp_replace(lower(client_name),'[^[:alnum:]]','','g')=canon;
      if n>1 then
        problem:='Несколько клиентов с похожим названием'; cid:=null;
      elsif n=0 then
        select count(*) into n from public.csm_camps where
          regexp_replace(lower(name),'[^[:alnum:]]','','g')=canon;
        if n>1 or exists(select 1 from public.csm_camps where
          regexp_replace(lower(name),'[^[:alnum:]]','','g')=canon
          and sales_client_id is not null) then
          problem:='Неоднозначная карточка КСМ';
        else
          insert into public.salary_clients(client_name,contractor_id,signed_date,active,created_by)
          values(nm,new.user_id,dt,true,auth.uid()) returning id into cid;
        end if;
      end if;
    end if;
    if problem='' and cid is not null then
      update public.salary_clients set active=true where id=cid and not active;
      perform campbox_internal.apply_salary_client(
        cid,(select client_name from public.salary_clients where id=cid),true);
      if not exists(select 1 from public.csm_camps where sales_client_id=cid) then
        problem:='Передача в КСМ заблокирована конфликтом';
      end if;
    end if;
    insert into campbox_internal.sales_signed_handoffs
      (sales_user_id,contract_key,client_name,signed_date,salary_client_id,state,reason)
    values(new.user_id,ky,nm,dt,cid,
      case when problem='' then 'linked' else 'conflict' end,problem)
    on conflict(sales_user_id,contract_key) do update set
      client_name=excluded.client_name,signed_date=excluded.signed_date,
      salary_client_id=coalesce(sales_signed_handoffs.salary_client_id,
                                excluded.salary_client_id),
      state=excluded.state,reason=excluded.reason,changed_at=now();
    insert into public.sales_handoff_statuses
      (sales_user_id,contract_key,state,reason,assigned)
    values(
      new.user_id,ky,
      case when problem='' then 'linked' else 'conflict' end,
      problem,
      exists(select 1 from public.csm_camps
             where sales_client_id=cid and responsible_id is not null)
    )
    on conflict (sales_user_id,contract_key) do update
      set state=excluded.state,reason=excluded.reason,
          assigned=excluded.assigned,updated_at=now();
    exception when others then
      insert into public.sales_handoff_statuses(sales_user_id,contract_key,state,reason,assigned)
      values(new.user_id,item->>'id','error','Ошибка синхронизации; факт продажи сохранён',false)
      on conflict(sales_user_id,contract_key) do update set state='error',reason=excluded.reason,assigned=false,updated_at=now();
    end;
  end loop;
  return new;
end;
$f$;

revoke all on function campbox_internal.sync_signed_deal() from public,anon,authenticated;
commit;
