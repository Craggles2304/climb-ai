-- Activation analytics storage.
--
-- The application already had server-side telemetry code, but the production
-- Supabase project did not contain analytics_events. This migration makes the
-- event pipeline durable and deliberately keeps the table server-only: the
-- browser sends events to /api/events and never receives direct table access.

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  anon_id text not null,
  session_id text not null,
  event text not null,
  props jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists analytics_events_anon_idx
  on public.analytics_events(anon_id, occurred_at desc);
create index if not exists analytics_events_event_idx
  on public.analytics_events(event, occurred_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events(session_id);
create index if not exists analytics_events_user_idx
  on public.analytics_events(user_id, occurred_at desc)
  where user_id is not null;

alter table public.analytics_events enable row level security;

-- Writes and founder reporting go through server-side service-role code.
-- No signed-out or ordinary signed-in client needs direct table privileges.
revoke all on table public.analytics_events from anon, authenticated;

drop policy if exists "analytics_events_no_client_access" on public.analytics_events;
create policy "analytics_events_no_client_access"
on public.analytics_events
for all
to anon, authenticated
using (false)
with check (false);
