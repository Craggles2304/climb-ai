create table if not exists public.live_player_read_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid null references public.riot_accounts(id) on delete set null,
  device_id uuid not null references public.live_tracker_devices(id) on delete cascade,
  session_id uuid not null references public.live_telemetry_sessions(id) on delete cascade,
  checkpoint_minute integer not null check (checkpoint_minute in (5,10,15)),
  game_seconds numeric not null,
  state_read text not null check (state_read in ('AHEAD','EVEN','BEHIND')),
  threat_read text null,
  priority_read text null,
  source text not null default 'PLAYER_CHECKPOINT',
  created_at timestamptz not null default now(),
  unique(session_id,checkpoint_minute)
);

create index if not exists live_player_read_checkpoints_user_idx
  on public.live_player_read_checkpoints(user_id,created_at desc);

create index if not exists live_player_read_checkpoints_session_idx
  on public.live_player_read_checkpoints(session_id,checkpoint_minute);
