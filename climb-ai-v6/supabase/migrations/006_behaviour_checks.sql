-- OVERPOWERED — behaviour adherence.
--
-- The plan asks for a behaviour and scores a metric. Those are different things,
-- and without recording both there is no way to tell whether a leak is a cause
-- or a symptom. This table holds the missing variable.

create table if not exists public.behaviour_checks (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  anon_id     text not null,
  session_id  text,
  match_id    text not null,
  task_id     text,
  -- Did the player attempt the behaviour?
  adherence   text not null check (adherence in ('YES','PARTLY','NO')),
  -- Did the metric clear its bar in that same game?
  cleared_bar boolean not null,
  outcome     text not null check (outcome in ('CONFIRMED','UNREWARDED','UNEARNED','NO_REP')),
  created_at  timestamptz not null default now(),
  -- One report per player per match; a corrected answer replaces the old one.
  unique (anon_id, match_id)
);

create index if not exists behaviour_checks_outcome_idx on public.behaviour_checks(outcome, created_at desc);
create index if not exists behaviour_checks_task_idx    on public.behaviour_checks(task_id);

alter table public.behaviour_checks enable row level security;

drop policy if exists "behaviour_checks_owner" on public.behaviour_checks;
create policy "behaviour_checks_owner" on public.behaviour_checks
  for select using (auth.uid() = user_id);
