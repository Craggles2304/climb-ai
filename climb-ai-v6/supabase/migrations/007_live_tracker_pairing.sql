create table if not exists live_tracker_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_key text not null,
  device_name text not null default 'Windows PC',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

alter table live_telemetry_sessions add column if not exists account_key text;
alter table live_telemetry_sessions add column if not exists client_session_id text;
alter table live_telemetry_sessions add column if not exists status text not null default 'ACTIVE';
alter table live_telemetry_sessions add column if not exists last_seen_at timestamptz;
alter table live_telemetry_sessions add column if not exists summary jsonb not null default '{}'::jsonb;

create unique index if not exists live_telemetry_device_session_idx on live_telemetry_sessions(device_id,client_session_id) where device_id is not null and client_session_id is not null;
create index if not exists live_telemetry_user_account_idx on live_telemetry_sessions(user_id,account_key,started_at desc);
create index if not exists live_telemetry_snapshot_session_time_idx on live_telemetry_snapshots(session_id,game_time);

alter table live_tracker_devices enable row level security;
create policy "users own tracker devices" on live_tracker_devices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
