-- CampBox Meeting Insights v1 (non-destructive migration)
-- Apply in the existing Sales Board Supabase project AFTER review.
-- Contains derived scoring/insights; DO NOT store full transcripts or personal contact details.
create table if not exists public.meeting_analyses (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id),
  meeting_key text not null check (length(meeting_key) between 3 and 160),
  meeting_date date not null,
  client_label text not null default '' check (length(client_label) <= 200),
  meeting_type text not null default 'OTHER'
    check (meeting_type in ('DISCOVERY','DEMO','NEGOTIATION','FOLLOW_UP','OTHER')),
  assessment_version text not null default '1.2.0' check (length(assessment_version) <= 40),
  total_score numeric(5,2) not null check (total_score between 0 and 100),
  coverage_pct numeric(5,2) check (coverage_pct between 0 and 100),
  reliability text not null default 'PROVISIONAL'
    check (reliability in ('RELIABLE','PROVISIONAL','INSUFFICIENT_DATA')),
  skill_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(skill_scores)='object'),
  error_codes jsonb not null default '[]'::jsonb check (jsonb_typeof(error_codes)='array'),
  strengths jsonb not null default '[]'::jsonb check (jsonb_typeof(strengths)='array'),
  growth_areas jsonb not null default '[]'::jsonb check (jsonb_typeof(growth_areas)='array'),
  coaching_focus text not null default '' check (length(coaching_focus)<=2000),
  marketing_insights jsonb not null default '[]'::jsonb check (jsonb_typeof(marketing_insights)='array'),
  next_step text not null default '' check (length(next_step)<=2000),
  outcome text not null default 'UNKNOWN'
    check (outcome in ('UNKNOWN','NEXT_MEETING','PROPOSAL','CONTRACT_SENT','SIGNED','LOST')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(manager_id, meeting_key)
);
create index if not exists meeting_analyses_date_idx on public.meeting_analyses(manager_id,meeting_date desc);
create index if not exists meeting_analyses_type_idx on public.meeting_analyses(meeting_type,assessment_version,meeting_date desc);
create index if not exists meeting_analyses_outcome_idx on public.meeting_analyses(outcome);

create or replace function public.meeting_analyses_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at=now();
  return new;
end $$;
drop trigger if exists trg_meeting_analyses_touch on public.meeting_analyses;
create trigger trg_meeting_analyses_touch before update on public.meeting_analyses
for each row execute function public.meeting_analyses_touch();

alter table public.meeting_analyses enable row level security;
revoke all on public.meeting_analyses from anon, authenticated;
grant select, insert, update, delete on public.meeting_analyses to authenticated;

drop policy if exists meeting_analyses_read on public.meeting_analyses;
create policy meeting_analyses_read on public.meeting_analyses
for select to authenticated using (
  public.is_active_user() and (manager_id=auth.uid() or public.is_manager())
);
drop policy if exists meeting_analyses_insert on public.meeting_analyses;
create policy meeting_analyses_insert on public.meeting_analyses
for insert to authenticated with check (
  public.is_active_user() and (manager_id=auth.uid() or public.is_manager())
  and created_by=auth.uid()
);
drop policy if exists meeting_analyses_update on public.meeting_analyses;
create policy meeting_analyses_update on public.meeting_analyses
for update to authenticated using (
  public.is_active_user() and (manager_id=auth.uid() or public.is_manager())
) with check (
  public.is_active_user() and (manager_id=auth.uid() or public.is_manager())
);
drop policy if exists meeting_analyses_delete on public.meeting_analyses;
create policy meeting_analyses_delete on public.meeting_analyses
for delete to authenticated using (public.is_manager());
