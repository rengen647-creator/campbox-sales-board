-- STAGED ONLY. Requires existing sales -> CSM migration dated 2026-10-08.
-- Never create salary_contracts or accrue bonuses from a daily Sales status.
begin;
create table if not exists campbox_internal.sales_signed_handoffs (
  sales_user_id uuid not null,
  contract_key text not null,
  client_name text not null,
  signed_date date,
  salary_client_id uuid references public.salary_clients(id),
  state text not null check (state in ('linked','conflict')),
  reason text not null default '',
  changed_at timestamptz not null default now(),
  primary key (sales_user_id,contract_key)
);
revoke all on campbox_internal.sales_signed_handoffs from public,anon,authenticated;

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
  if doc->>'__type'<>'daily_reflection' or
     jsonb_typeof(doc->'contracts')<>'array' then return new; end if;
  for item in select value from jsonb_array_elements(doc->'contracts') loop
    if item->>'status'<>'signed' then continue; end if;
    nm:=btrim(coalesce(item->>'client',''));
    ky:=btrim(coalesce(item->>'id',''));
    if ky='' then continue; end if;
    if length(ky)>128 then ky:=left(ky,128); end if;
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
      select count(*),min(id) into n,cid from public.salary_clients
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
      salary_client_id=coalesce(campbox_internal.sales_signed_handoffs.salary_client_id,
                                excluded.salary_client_id),
      state=excluded.state,reason=excluded.reason,changed_at=now();
  end loop;
  return new;
end;
$f$;
revoke all on function campbox_internal.sync_signed_deal()
 from public,anon,authenticated;
drop trigger if exists daily_sales_signed_to_csm on public.daily_sales;
create trigger daily_sales_signed_to_csm
after insert or update of comment on public.daily_sales
for each row execute function campbox_internal.sync_signed_deal();

create or replace function public.sales_handoff_status(p_user_id uuid)
returns table(contract_key text,state text,reason text,assigned boolean)
language plpgsql security definer set search_path=''
as $f$
begin
  if auth.uid() is null or not exists(
    select 1 from public.profiles where id=auth.uid() and active
      and role in ('employee','manager')
  ) then raise exception 'Sales access required' using errcode='42501'; end if;
  if p_user_id<>auth.uid() and not public.is_manager() then
    raise exception 'No access to colleague data' using errcode='42501'; end if;
  return query
    select h.contract_key,h.state,h.reason,
           coalesce(c.responsible_id is not null,false)
    from campbox_internal.sales_signed_handoffs h
    left join public.csm_camps c on c.sales_client_id=h.salary_client_id
    where h.sales_user_id=p_user_id;
end;
$f$;
revoke all on function public.sales_handoff_status(uuid)
 from public,anon,authenticated;
grant execute on function public.sales_handoff_status(uuid) to authenticated;
commit;
-- No existing records are backfilled. Before live use: backup, staging tests,
-- security advisor, duplicate review, and explicit release approval.
