-- OP CLIMB local League Client champ-select context.
-- This does not use Riot's public production API; the Windows companion reads
-- the authenticated local League Client (LCU) and sends only draft context.

alter table public.live_tracker_devices
  add column if not exists pregame_context jsonb,
  add column if not exists pregame_updated_at timestamptz;

create index if not exists live_tracker_pregame_idx
  on public.live_tracker_devices(user_id, account_key, pregame_updated_at desc);

create table if not exists public.live_pregame_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  riot_account_id uuid,
  account_key text not null,
  device_id uuid not null references public.live_tracker_devices(id) on delete cascade,
  client_pregame_id text not null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(device_id, client_pregame_id)
);

create index if not exists live_pregame_user_account_idx
  on public.live_pregame_contexts(user_id, account_key, started_at desc);

alter table public.live_pregame_contexts enable row level security;

drop policy if exists "live_pregame_owner" on public.live_pregame_contexts;
create policy "live_pregame_owner" on public.live_pregame_contexts
  for select using (auth.uid() = user_id);
