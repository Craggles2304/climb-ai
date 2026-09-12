-- OP CLIMB — persistent PRO coaching evidence and multi-game learning profile.
-- Match-level analysis stores the evidence used by the Fix Ladder; the profile
-- stores rollups only so the UI can read a player's recurring patterns quickly.

create table if not exists public.op_match_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  riot_account_id uuid references public.riot_accounts(id) on delete cascade,
  session_id uuid unique references public.live_telemetry_sessions(id) on delete cascade,
  match_id uuid unique references public.matches(id) on delete cascade,
  external_match_id text,
  champion text not null,
  role text,
  evidence_sources text[] not null default '{}'::text[],
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists op_match_analysis_user_external_idx
  on public.op_match_analysis(user_id, external_match_id)
  where external_match_id is not null;
create index if not exists op_match_analysis_account_time_idx
  on public.op_match_analysis(riot_account_id, created_at desc);
create index if not exists op_match_analysis_user_time_idx
  on public.op_match_analysis(user_id, created_at desc);

create table if not exists public.op_player_learning_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  riot_account_id uuid not null references public.riot_accounts(id) on delete cascade,
  games_analyzed int not null default 0,
  fingerprint jsonb not null default '{}'::jsonb,
  metric_rollups jsonb not null default '{}'::jsonb,
  fix_ladder jsonb not null default '[]'::jsonb,
  champion_profiles jsonb not null default '{}'::jsonb,
  latest_analysis_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, riot_account_id)
);

create index if not exists op_learning_profiles_user_idx
  on public.op_player_learning_profiles(user_id, updated_at desc);

alter table public.op_match_analysis enable row level security;
alter table public.op_player_learning_profiles enable row level security;

create policy "op_match_analysis_owner_read" on public.op_match_analysis
  for select using (auth.uid() = user_id);
create policy "op_learning_profile_owner_read" on public.op_player_learning_profiles
  for select using (auth.uid() = user_id);
