-- CampBox Sales Board — retention cycle extension (REVIEW ONLY)
-- Requires salary_v1_migration.sql. Run on an isolated test project first.
-- Do NOT run against production until salary + payout rules are approved.

create table if not exists public.salary_retentions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.salary_contracts(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress','successful','unsuccessful')),
  opened_at date not null,
  resolved_at date,
  retained_by uuid references public.profiles(id) on delete restrict,
  reason text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retention_resolution_check check (
    (status='in_progress' and resolved_at is null and retained_by is null)
    or (status='successful' and resolved_at is not null and retained_by is not null)
    or (status='unsuccessful' and resolved_at is not null and retained_by is null)
  ),
  constraint retention_dates_check check (resolved_at is null or resolved_at>=opened_at)
);

create unique index if not exists salary_retentions_one_open_uidx
  on public.salary_retentions(contract_id) where status='in_progress';
create index if not exists salary_retentions_contract_date_idx
  on public.salary_retentions(contract_id, resolved_at desc)
  where status='successful';
create index if not exists salary_retentions_created_at_idx
  on public.salary_retentions(created_at desc);

-- A successful retention belongs only to the existing contract's contractor.
-- Changing manager ownership needs a separate business decision and rule.
create or replace function public.salary_retention_validate()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_contractor uuid;
  v_contract_status text;
begin
  -- Successful and unsuccessful results are immutable; corrections require a
  -- deliberate audited administrative process, not an ordinary row update.
  if tg_op='INSERT' and new.status<>'in_progress' then
    raise exception 'A retention case must start in progress';
  end if;
  if tg_op='UPDATE' then
    if old.status<>'in_progress' then
      raise exception 'Completed retention cases cannot be modified';
    end if;
    if new.contract_id is distinct from old.contract_id then
      raise exception 'Cannot change contract of an existing retention case';
    end if;
  end if;

  if new.opened_at>current_date or
     (new.resolved_at is not null and new.resolved_at>current_date) then
    raise exception 'Retention dates cannot be in the future';
  end if;

  -- Lock the parent contract to serialize parallel retention confirmations.
  -- Prevents two simultaneous requests from creating overlapping windows.
  select contractor_id, status into v_contractor,v_contract_status
  from public.salary_contracts where id=new.contract_id for update;
  if not found then raise exception 'Contract not found'; end if;

  if new.status='successful' then
    if v_contract_status<>'active' then
      raise exception 'Retention can be confirmed only for an active contract';
    end if;
    if new.retained_by is distinct from v_contractor then
      raise exception 'Retention manager must match the contract contractor';
    end if;
    if exists(
      select 1 from public.salary_retentions r
      where r.contract_id=new.contract_id and r.status='successful'
        and r.id<>new.id
        and daterange(r.resolved_at,(r.resolved_at+interval '6 months')::date,'[)')
          && daterange(new.resolved_at,(new.resolved_at+interval '6 months')::date,'[)')
    ) then
      raise exception 'Successful retention window overlaps an existing one';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists salary_retentions_validate on public.salary_retentions;
create trigger salary_retentions_validate
before insert or update on public.salary_retentions
for each row execute procedure public.salary_retention_validate();

alter table public.salary_retentions enable row level security;
revoke all on public.salary_retentions from anon;
revoke delete on public.salary_retentions from authenticated;
grant select,insert,update on public.salary_retentions to authenticated;

drop policy if exists salary_retentions_select on public.salary_retentions;
create policy salary_retentions_select on public.salary_retentions
for select to authenticated
using (
  public.is_manager()
  or (
    public.is_active_user() and exists (
      select 1 from public.salary_contracts c
      where c.id=salary_retentions.contract_id
      and c.contractor_id=(select auth.uid())
    )
  )
);

drop policy if exists salary_retentions_insert on public.salary_retentions;
create policy salary_retentions_insert on public.salary_retentions
for insert to authenticated with check (
  public.is_manager() and created_by=(select auth.uid())
);

drop policy if exists salary_retentions_update on public.salary_retentions;
create policy salary_retentions_update on public.salary_retentions
for update to authenticated
using (public.is_manager()) with check (public.is_manager());

-- Completed events are retained for audit; no client-side DELETE policy.
drop policy if exists salary_retentions_delete on public.salary_retentions;

drop trigger if exists salary_retentions_audit on public.salary_retentions;
create trigger salary_retentions_audit
after insert or update or delete on public.salary_retentions
for each row execute procedure public.salary_audit_trigger();

comment on table public.salary_retentions is
  'At-risk client retention events. Successful event creates a six-calendar-month variable commission window counted from resolved_at, without a duplicate contract-signing bonus.';
