-- OVERPOWERED — server-side analytics + feedback capture.
--
-- Both need to work BEFORE authentication exists, because the first 25 founder
-- testers are the reason these tables exist and they will not have accounts on
-- day one. Every row therefore carries a pseudonymous `anon_id` (a random UUID
-- generated in the browser, never anything derived from the person) and a
-- nullable `user_id` that gets populated once auth lands.

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  anon_id      text not null,
  session_id   text not null,
  event        text not null,
  props        jsonb not null default '{}'::jsonb,
  -- Client clock, kept because it orders a session correctly even when a batch
  -- arrives late. `received_at` is the server clock and is the one to trust.
  occurred_at  timestamptz not null,
  received_at  timestamptz not null default now()
);

create index if not exists analytics_events_anon_idx    on public.analytics_events(anon_id, occurred_at desc);
create index if not exists analytics_events_event_idx   on public.analytics_events(event, occurred_at desc);
create index if not exists analytics_events_session_idx on public.analytics_events(session_id);

-- The existing feedback table assumes an authenticated user and an analysis row.
-- Relax both so a founder tester can tell us a diagnosis is wrong immediately.
alter table public.feedback
  alter column user_id drop not null;

alter table public.feedback
  add column if not exists anon_id     text,
  -- Which claim is being rated: 'leak_price', 'ilp_task', 'analysis', 'coach'.
  add column if not exists surface     text,
  -- The specific thing rated, e.g. the metric key or task id, so a pattern of
  -- "this diagnosis is always wrong for junglers" is actually findable.
  add column if not exists subject     text,
  add column if not exists rank_band   text,
  add column if not exists role        text,
  add column if not exists session_id  text;

create index if not exists feedback_surface_idx on public.feedback(surface, useful);
create index if not exists feedback_subject_idx on public.feedback(subject);

alter table public.analytics_events enable row level security;
alter table public.feedback         enable row level security;

-- Writes arrive through a server route using the service role, which bypasses
-- RLS. These policies exist so that when a user session does read directly,
-- it can only ever see its own rows.
drop policy if exists "analytics_events_owner" on public.analytics_events;
create policy "analytics_events_owner" on public.analytics_events
  for select using (auth.uid() = user_id);

drop policy if exists "feedback_owner" on public.feedback;
create policy "feedback_owner" on public.feedback
  for select using (auth.uid() = user_id);
