-- Backfill queue_id for rows that predate 20261025114503_ranked_solo_only.sql.
--
-- READY TO RUN, BUT NOT YET RUN. Before applying:
--   1. Take a backup. The project is on the Free plan with no automatic ones.
--   2. Run the audit in docs/QUEUE_ID_BACKFILL.md and keep the output.
--   3. Run this inside one transaction (it is wrapped below).
--   4. Run the verification in that document and compare.
-- The rollback in that document undoes exactly what this wrote, and nothing else.
--
-- Principle: only set queue_id where this database already holds evidence of
-- the real queue. Never assume 420. A blanket backfill would re-admit normal,
-- flex and ARAM games into Ranked Solo/Duo progression, which is exactly what
-- the ranked_solo_only change set out to prevent. Rows with no evidence keep
-- queue_id NULL and stay excluded, by design.
--
-- Every statement is NULL-guarded, so this is safe to run more than once and
-- never overwrites a queue_id that is already set. Every row it does write is
-- recorded in queue_id_backfill_log, which is what makes it reversible: the
-- application also writes queue_id on new rows, so without that log a rollback
-- could not tell the two apart.

begin;

create table if not exists public.queue_id_backfill_log(
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid not null,
  queue_id integer not null,
  source text not null,
  applied_at timestamptz not null default now()
);

comment on table public.queue_id_backfill_log is
  'One row per value written by the queue_id backfill. Used to reverse it precisely. Safe to keep.';

-- 1. op_match_analysis already carries the queue inside its own analysis
--    payload (ProMatchAnalysis.queueId), from both the live and Match-V5 paths.
with updated as (
  update public.op_match_analysis a
     set queue_id = (a.analysis->>'queueId')::int
   where a.queue_id is null
     and jsonb_typeof(a.analysis->'queueId') = 'number'
  returning a.id, a.queue_id
)
insert into public.queue_id_backfill_log(table_name,row_id,queue_id,source)
select 'op_match_analysis', id, queue_id, 'analysis_payload' from updated;

-- 2. Sessions finalised after the ranked work landed recorded their eligibility
--    in the summary.
with updated as (
  update public.live_telemetry_sessions s
     set queue_id = (s.summary->'rankedEligibility'->>'queueId')::int
   where s.queue_id is null
     and jsonb_typeof(s.summary->'rankedEligibility'->'queueId') = 'number'
  returning s.id, s.queue_id
)
insert into public.queue_id_backfill_log(table_name,row_id,queue_id,source)
select 'live_telemetry_sessions', id, queue_id, 'session_summary' from updated;

-- 3. Older sessions: derive from the stored keyframes, but only when every
--    frame agrees. This mirrors recordedQueueId() in lib/rankedSolo.ts, which
--    returns null unless exactly one distinct queue id was observed.
with observed as (
  select session_id,
         min((payload->>'queueId')::int) as queue_id,
         count(distinct payload->>'queueId') as variants
    from public.live_telemetry_snapshots
   where jsonb_typeof(payload->'queueId') = 'number'
   group by session_id
), updated as (
  update public.live_telemetry_sessions s
     set queue_id = o.queue_id
    from observed o
   where o.session_id = s.id
     and s.queue_id is null
     and o.variants = 1
  returning s.id, s.queue_id
)
insert into public.queue_id_backfill_log(table_name,row_id,queue_id,source)
select 'live_telemetry_sessions', id, queue_id, 'agreeing_keyframes' from updated;

-- 4. Companion-recorded matches inherit the queue their session proved.
--    matches.live_session_id is used throughout the application but does not
--    appear in any migration in this repository, so the live schema has drifted
--    from version control. Guarded rather than assumed; PR #255 records it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'matches'
       and column_name = 'live_session_id'
  ) then
    with updated as (
      update public.matches m
         set queue_id = s.queue_id
        from public.live_telemetry_sessions s
       where s.id = m.live_session_id
         and m.queue_id is null
         and s.queue_id is not null
      returning m.id, m.queue_id
    )
    insert into public.queue_id_backfill_log(table_name,row_id,queue_id,source)
    select 'matches', id, queue_id, 'owning_session' from updated;
  else
    raise notice 'skipped: matches.live_session_id does not exist in this database';
  end if;
end $$;

-- 5. Riot-synced matches: the Match-V5 analysis kept alongside the metrics
--    carries info.queueId.
with updated as (
  update public.matches m
     set queue_id = (mm.raw->'proAnalysis'->>'queueId')::int
    from public.match_metrics mm
   where mm.match_id = m.id
     and m.queue_id is null
     and jsonb_typeof(mm.raw->'proAnalysis'->'queueId') = 'number'
  returning m.id, m.queue_id
)
insert into public.queue_id_backfill_log(table_name,row_id,queue_id,source)
select 'matches', id, queue_id, 'match_v5_analysis' from updated;

-- 6. Anything left that has an analysis row with a verified queue.
with updated as (
  update public.matches m
     set queue_id = a.queue_id
    from public.op_match_analysis a
   where a.match_id = m.id
     and m.queue_id is null
     and a.queue_id is not null
  returning m.id, m.queue_id
)
insert into public.queue_id_backfill_log(table_name,row_id,queue_id,source)
select 'matches', id, queue_id, 'linked_analysis' from updated;

commit;
