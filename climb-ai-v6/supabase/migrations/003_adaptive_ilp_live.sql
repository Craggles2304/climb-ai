-- CLIMB//AI V6 adaptive ILP + live telemetry foundation
alter table if exists missions add column if not exists ilp_task_id uuid null;

create table if not exists ilp_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid null,
  title text not null,
  category text not null,
  why text not null,
  game_rule text not null,
  metric text not null,
  target text not null,
  priority int not null default 50,
  progress int not null default 0 check (progress between 0 and 100),
  status text not null default 'ACTIVE',
  source text not null default 'SYSTEM',
  successful_games int not null default 0,
  games_observed int not null default 0,
  mastery_required int not null default 3,
  latest_reason text,
  evidence jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists live_telemetry_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid null,
  device_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists live_telemetry_snapshots (
  id bigint generated always as identity primary key,
  session_id uuid not null references live_telemetry_sessions(id) on delete cascade,
  game_time numeric not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table ilp_tasks enable row level security;
alter table live_telemetry_sessions enable row level security;
alter table live_telemetry_snapshots enable row level security;

create policy "users own ilp" on ilp_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own live sessions" on live_telemetry_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own live snapshots" on live_telemetry_snapshots for all using (
  exists (select 1 from live_telemetry_sessions s where s.id = session_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from live_telemetry_sessions s where s.id = session_id and s.user_id = auth.uid())
);
