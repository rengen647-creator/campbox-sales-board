-- READ ONLY. Stable keys, source date disagreements and candidate associations.
-- No INSERT, UPDATE, DELETE, temporary tables or backfill side effects.
with docs as (
 select user_id,report_date,updated_at,case when pg_input_is_valid(comment,'jsonb') then comment::jsonb else '{}'::jsonb end doc from public.daily_sales
), observations as (
 select user_id,report_date,updated_at,item from docs cross join lateral jsonb_array_elements(case when jsonb_typeof(doc->'contracts')='array' then doc->'contracts' else '[]'::jsonb end) item
), latest as (
 select distinct on(user_id,item->>'id') * from observations order by user_id,item->>'id',report_date desc,updated_at desc
)
select l.user_id,l.item->>'id' contract_key,l.item->>'client' camp_name,l.item->>'status' deal_status,
 l.item->>'signed_date' sales_signed_date,l.item->>'contract_number' document_number,
 h.salary_client_id,h.state handoff_state,sc.id salary_cycle_id,sc.signed_date salary_signed_date,
 sc.contractor_id salary_owner,sc.status salary_status,
 cl.client_name finance_client_name,cl.signed_date client_signed_date,c.name csm_name,c.contract_number csm_document,
 (select sum(coalesce(d.connected_fact,0)) from public.daily_sales d where d.user_id=l.user_id and date_trunc('month',d.report_date)=date_trunc('month',case when pg_input_is_valid(l.item->>'signed_date','date') then (l.item->>'signed_date')::date end)) manual_launches_same_month,
 case when coalesce(l.item->>'id','')='' then 'missing_deal_id'
 when not pg_input_is_valid(l.item->>'signed_date','date') then 'invalid_signed_date'
 when sc.id is null then 'no_financial_cycle__not_an_error_for_sales'
 when sc.contractor_id<>l.user_id then 'owner_mismatch'
 when sc.signed_date::text is distinct from l.item->>'signed_date' then 'signed_date_mismatch'
 else 'candidate_requires_approval' end reconciliation,
 (select count(*) from observations o where o.user_id=l.user_id and o.item->>'id'=l.item->>'id') observations,
 (select count(distinct o.item->>'signed_date') from observations o where o.user_id=l.user_id and o.item->>'id'=l.item->>'id' and o.item->>'status'='signed') observed_signature_dates
from latest l
left join campbox_internal.sales_signed_handoffs h on h.sales_user_id=l.user_id and h.contract_key=l.item->>'id'
left join public.salary_contracts sc on sc.sales_source_user_id=l.user_id and sc.sales_source_contract_key=l.item->>'id'
left join public.salary_clients cl on cl.id=h.salary_client_id
left join public.csm_camps c on c.sales_client_id=cl.id
where l.item->>'status'='signed'
order by l.user_id,l.item->>'id',sc.id;
