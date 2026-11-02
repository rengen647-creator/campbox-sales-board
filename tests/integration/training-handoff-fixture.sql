-- Disposable localhost QA schema ONLY. Never apply this fixture to production.
alter table public.salary_contracts
 add column if not exists sales_source_user_id uuid,
 add column if not exists sales_source_contract_key text;
create table if not exists public.sales_training_handoff_events(
 id uuid primary key default gen_random_uuid(),
 sales_user_id uuid not null,
 contract_key text not null,
 source_revision bigint not null,
 camp_name text not null default '',
 contract_number text not null default '',
 signed_date date,
 training_date date,
 training_attendee text not null default '',
 customer_confirmed boolean not null default false,
 salary_contract_id uuid references public.salary_contracts(id),
 created_at timestamptz not null default now(),
 unique(sales_user_id,contract_key,source_revision)
);
alter table public.sales_training_handoff_events enable row level security;
grant select,insert on public.sales_training_handoff_events to authenticated;
create policy training_test_read on public.sales_training_handoff_events for select to authenticated
 using (sales_user_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role='manager' and active));
create policy training_test_insert on public.sales_training_handoff_events for insert to authenticated
 with check(sales_user_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role='manager' and active));
create table if not exists public.csm_training_handoff_acks(
 event_id uuid primary key references public.sales_training_handoff_events(id),
 accepted_by uuid not null,
 accepted_at timestamptz not null default now()
);
alter table public.csm_training_handoff_acks enable row level security;
grant select on public.csm_training_handoff_acks to authenticated;
create policy training_test_ack_read on public.csm_training_handoff_acks for select to authenticated
 using(exists(select 1 from public.sales_training_handoff_events where id=event_id));
