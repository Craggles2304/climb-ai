create table if not exists public.tft_telemetry_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid references public.riot_accounts(id) on delete set null,
  device_id uuid references public.live_tracker_devices(id) on delete set null,
  pseudo_match_id text not null,
  linked_tft_match_id uuid references public.tft_matches(id) on delete set null,
  status text not null default 'RECORDING' check (status in ('RECORDING','COMPLETE','ABORTED')),
  source text not null default 'OVERWOLF_GEP' check (source in ('OVERWOLF_GEP','IMPORTED_JSON')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_seen_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(device_id,pseudo_match_id)
);

create index if not exists tft_telemetry_sessions_user_started_idx
  on public.tft_telemetry_sessions(user_id, started_at desc);
create index if not exists tft_telemetry_sessions_account_started_idx
  on public.tft_telemetry_sessions(riot_account_id, started_at desc)
  where riot_account_id is not null;

create table if not exists public.tft_telemetry_points (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.tft_telemetry_sessions(id) on delete cascade,
  client_point_id text not null,
  observed_at timestamptz not null,
  round text not null,
  event_kind text not null check (event_kind in ('MATCH_START','ROUND_START','ROUND_END','MATCH_END','CHECKPOINT')),
  gold integer check (gold is null or gold >= 0),
  level integer check (level is null or (level between 1 and 12)),
  xp integer check (xp is null or xp >= 0),
  hp integer check (hp is null or (hp between 0 and 200)),
  placement integer check (placement is null or (placement between 1 and 8)),
  shop_refreshes integer check (shop_refreshes is null or shop_refreshes >= 0),
  purchases integer check (purchases is null or purchases >= 0),
  board_power integer check (board_power is null or board_power >= 0),
  board_units integer check (board_units is null or board_units >= 0),
  bench_units integer check (bench_units is null or bench_units >= 0),
  completed_items integer check (completed_items is null or completed_items >= 0),
  board jsonb not null default '[]'::jsonb,
  bench jsonb not null default '[]'::jsonb,
  shop jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id,client_point_id)
);

create index if not exists tft_telemetry_points_session_observed_idx
  on public.tft_telemetry_points(session_id, observed_at);

alter table public.tft_telemetry_sessions enable row level security;
alter table public.tft_telemetry_points enable row level security;

revoke all on public.tft_telemetry_sessions from anon, authenticated;
revoke all on public.tft_telemetry_points from anon, authenticated;
grant select on public.tft_telemetry_sessions to authenticated;
grant select on public.tft_telemetry_points to authenticated;

drop policy if exists "Users can read own TFT telemetry sessions" on public.tft_telemetry_sessions;
create policy "Users can read own TFT telemetry sessions"
on public.tft_telemetry_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own TFT telemetry points" on public.tft_telemetry_points;
create policy "Users can read own TFT telemetry points"
on public.tft_telemetry_points
for select
to authenticated
using (
  exists (
    select 1 from public.tft_telemetry_sessions s
    where s.id = tft_telemetry_points.session_id
      and s.user_id = (select auth.uid())
  )
);
