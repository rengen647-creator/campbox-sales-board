-- Staging helper, invoker privileges only, session-local and never exposed by API.
-- Define it after signed-facts.sql. It performs NO import until explicitly called
-- with a reviewed JSON mapping and a named active manager after database backup.
-- Mapping: [{sales_user_id,contract_key,camp_name,signed_date,contract_number}]
-- Does not open periods, edit daily reports, create salary cycles or change CSM.
create or replace function pg_temp.import_approved_signed_facts(mapping jsonb, approver uuid)
returns integer language plpgsql set search_path='' as $f$
declare m jsonb; source jsonb; report_day date; cid uuid; saved public.sales_deal_registry%rowtype; imported integer:=0;
begin
 if not exists(select 1 from public.profiles where id=approver and active and role='manager') then raise exception 'Named active approving manager required'; end if;
 if jsonb_typeof(mapping)<>'array' or jsonb_array_length(mapping)=0 then raise exception 'Explicit reviewed mapping required'; end if;
 if exists(select 1 from jsonb_array_elements(mapping) x group by x->>'sales_user_id',x->>'contract_key' having count(*)>1) then raise exception 'Duplicate approved deal';end if;
 for m in select value from jsonb_array_elements(mapping) loop
  perform pg_advisory_xact_lock(hashtext('sales-fact:'||(m->>'sales_user_id')||':'||(m->>'contract_key')));
  select item,d.report_date into source,report_day from public.daily_sales d
  cross join lateral jsonb_array_elements(case when pg_input_is_valid(d.comment,'jsonb') then coalesce(d.comment::jsonb->'contracts','[]'::jsonb) else '[]'::jsonb end) item
  where d.user_id=(m->>'sales_user_id')::uuid and item->>'id'=m->>'contract_key'
  order by d.report_date desc limit 1;
  if source is null or source->>'status'<>'signed' or (source->>'client',source->>'signed_date',source->>'contract_number') is distinct from (m->>'camp_name',m->>'signed_date',m->>'contract_number') then
   raise exception 'Source changed or mapping mismatch for %',m->>'contract_key';
  end if;
  if nullif(btrim(m->>'camp_name'),'') is null or nullif(btrim(m->>'contract_number'),'') is null or (m->>'signed_date')::date>current_date then raise exception 'Invalid approved signature';end if;
  if exists(select 1 from public.sales_deal_registry where sales_user_id=(m->>'sales_user_id')::uuid and contract_key=m->>'contract_key') then
   if not exists(select 1 from public.sales_signed_events where sales_user_id=(m->>'sales_user_id')::uuid and contract_key=m->>'contract_key' and signed_date=(m->>'signed_date')::date and contract_number=m->>'contract_number' and state='confirmed') then raise exception 'Existing registry conflict';end if;
   continue;
  end if;
  insert into public.sales_camp_registry(sales_user_id,name) values((m->>'sales_user_id')::uuid,m->>'camp_name') returning id into cid;
  insert into public.sales_deal_registry(sales_user_id,contract_key,camp_id,document_key,contract_number,status,signed_date,sent_date,target_date,next_contact,next_action,blocker,ball,source_report_date,updated_by)
  values((m->>'sales_user_id')::uuid,m->>'contract_key',cid,(m->>'sales_user_id')||':'||(m->>'contract_key'),m->>'contract_number','signed',(m->>'signed_date')::date,nullif(source->>'sent_date','')::date,nullif(source->>'target_date','')::date,nullif(source->>'next_contact','')::date,coalesce(source->>'next_action',''),coalesce(source->>'blocker',''),coalesce(source->>'ball','client'),report_day,approver) returning * into saved;
  insert into public.sales_signed_events(sales_user_id,contract_key,camp_id,document_key,contract_number,signed_date,recorded_by)
  values(saved.sales_user_id,saved.contract_key,cid,saved.document_key,saved.contract_number,saved.signed_date,approver);
  insert into public.sales_fact_audit(sales_user_id,contract_key,actor_id,reason,before_value,after_value)
  values(saved.sales_user_id,saved.contract_key,approver,'Approved historical reconciliation',null,to_jsonb(saved)||jsonb_build_object('camp_name',m->>'camp_name'));
  imported:=imported+1;
 end loop;
 return imported;
end $f$;
