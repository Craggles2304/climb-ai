-- Add explicit queue provenance without assuming the mode of older recordings.
-- Existing RLS and ownership policies remain in place.
alter table public.matches add column if not exists queue_id integer;
alter table public.op_match_analysis add column if not exists queue_id integer;
alter table public.live_telemetry_sessions add column if not exists queue_id integer;
create index if not exists matches_ranked_solo_history_idx
  on public.matches(user_id,riot_account_id,occurred_at desc) where queue_id=420;
create index if not exists analysis_ranked_solo_history_idx
  on public.op_match_analysis(user_id,riot_account_id,created_at desc) where queue_id=420;
comment on column public.matches.queue_id is 'Riot/Companion queue identity. NULL is unverified; only 420 qualifies for Solo/Duo progression.';
