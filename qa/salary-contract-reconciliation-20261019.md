# Sales Board — reconciliation of signed contracts and salary (2026-10-19)

## Confirmed live discrepancy (read-only audit)
- Contracting: ФОК Гагаринский (60aa0e6a-4e92-46b9-bb2a-7a2953f66e70) — signed 2026-10-19.
- Contracting: Циалковский (e2e311ba-97c2-48ef-a913-6e19f5f1611b) — signed 2026-10-19.
- Salary: ФОК Гагаринский — two active contracts with 2026-10-15 dates.
- Salary: Циалковский — one active contract with 2026-10-15 date.
- No linked products, payments or pauses found for these three salary contracts.

## Root causes confirmed in source
- Contracting persists JSON contracts in daily_sales.comment.
- KSM handoff uses separate handoff pipeline.
- Salary uses salary_contracts / salary_clients; salaryFor() awards each row in salary_contracts.
- No canonical unique source contract ID in salary_contracts.
- Duplicate salary rows can generate duplicate fixed contractor accruals when department rate is positive.
- salary_department_months uses daily_sales.connected_fact (connected camps), which is not synonymous with signed contracts.

## Read-only reconciliation SQL
```sql
with signed as (
  select d.user_id,
         x->>'id' as sales_contract_id,
         x->>'client' as client_name,
         (x->>'signed_date')::date as signed_date,
         d.report_date
  from public.daily_sales d
  cross join lateral jsonb_array_elements(
    case when d.comment is not null and left(trim(d.comment),1)='{' 
      then coalesce((d.comment::jsonb)->'contracts','[]'::jsonb)
      else '[]'::jsonb end
  ) x
  where x->>'status'='signed' and coalesce(x->>'signed_date','') ~ '^\\d{4}-\\d{2}-\\d{2}$'
), latest as (
  select distinct on (user_id,sales_contract_id) *
  from signed order by user_id,sales_contract_id,report_date desc
)
select l.client_name,l.signed_date as sales_signed_date,
       count(sc.id) as salary_contract_rows,
       array_agg(sc.signed_date) filter (where sc.id is not null) as salary_signed_dates
from latest l
left join public.salary_clients c on lower(trim(c.client_name))=lower(trim(l.client_name))
left join public.salary_contracts sc on sc.client_id=c.id and sc.contractor_id=l.user_id
group by l.user_id,l.sales_contract_id,l.client_name,l.signed_date
having count(sc.id)<>1 or bool_or(sc.signed_date is distinct from l.signed_date)
order by l.signed_date desc,l.client_name;
```

## Required safe implementation
1. Add a stable reference to sales contract ID in salary_contracts, with a unique constraint scoped to the source; migration must backfill only unambiguously matched rows.
2. Reconcile existing rows through a reviewed mapping; preserve history, audit, payments and legitimate multi-cycle contracts.
3. Make signed-contract persistence and salary-cycle upsert idempotent server-side and transactional, with manager/owner authorization. Do not change RLS permissiveness.
4. Keep disconnected semantics: signed contract is not connected_fact and does not create a paid commission.
5. Add tests: first signing, repeated save, same camp new legitimate cycle, reverse/cancellation, RLS, differing dates, handoff intact, and no duplicate fixed accruals.
6. Do not deploy to production until test environment QA and review of ambiguous duplicate ФОК Гагаринский rows.

No production data changed by this report.
