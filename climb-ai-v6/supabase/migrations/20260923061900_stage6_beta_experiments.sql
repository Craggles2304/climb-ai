create table if not exists public.beta_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hypothesis text not null,
  metric_key text not null check (metric_key in (
    'activationToGradePct',
    'companionAdoptionPct',
    'trackedGameAfterCompanionPct',
    'sessionCompletionPct',
    'careerAdoptionPct',
    'usefulFeedbackPct',
    'day1ReturnPct',
    'day7ReturnPct'
  )),
  baseline_value numeric not null,
  target_value numeric not null,
  latest_value numeric,
  start_commit text,
  start_version text,
  status text not null default 'RUNNING' check (status in ('RUNNING','COMPLETE','CANCELLED')),
  outcome text,
  result jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists beta_experiments_one_running_idx
  on public.beta_experiments ((status))
  where status='RUNNING';

create index if not exists beta_experiments_started_idx
  on public.beta_experiments(started_at desc);

alter table public.beta_experiments enable row level security;

revoke all on table public.beta_experiments from anon, authenticated;
grant select, insert, update, delete on table public.beta_experiments to service_role;

drop policy if exists "beta_experiments_no_client_access" on public.beta_experiments;
create policy "beta_experiments_no_client_access"
on public.beta_experiments
for all
to anon, authenticated
using (false)
with check (false);
