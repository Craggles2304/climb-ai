alter table public.op_player_learning_profiles
  add column if not exists learning_model_version integer not null default 0,
  add column if not exists learning_model_health jsonb not null default '{}'::jsonb;

create index if not exists op_player_learning_profiles_model_version_idx
  on public.op_player_learning_profiles (learning_model_version, updated_at desc);

create table if not exists public.op_learning_rebuild_jobs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'ALL',
  requested_model_version integer not null,
  status text not null default 'PENDING',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error text,
  constraint op_learning_rebuild_jobs_scope_check check (scope in ('ALL')),
  constraint op_learning_rebuild_jobs_status_check check (status in ('PENDING','RUNNING','COMPLETE','FAILED'))
);

create index if not exists op_learning_rebuild_jobs_status_idx
  on public.op_learning_rebuild_jobs (status, expires_at);

alter table public.op_learning_rebuild_jobs enable row level security;
revoke all on table public.op_learning_rebuild_jobs from anon, authenticated;
grant select, insert, update, delete on table public.op_learning_rebuild_jobs to service_role;
