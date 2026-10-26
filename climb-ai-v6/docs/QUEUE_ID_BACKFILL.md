# queue_id backfill — audit before applying

`20261025114503_ranked_solo_only.sql` added `queue_id` to `matches`, `op_match_analysis` and `live_telemetry_sessions` and left every existing row NULL. Since PR #249 the application reads history through `.eq('queue_id',420)` in 24 files, and NULL never matches 420.

**This has already happened.** The migration was applied on 25 October and production deployed the filtering later the same day, so the history is hidden now — see the status section below for how it was confirmed and how to measure it.

## Before anything

- The project is on the Supabase **Free** plan with **no backups**. Take one.
- `20261026090000_backfill_queue_id_from_evidence.sql` is a draft and has not been run anywhere.

## What the draft does, and does not, do

It sets `queue_id` only where this database already holds evidence of the real queue:

| Source | Fills |
|---|---|
| `op_match_analysis.analysis->>'queueId'` | `op_match_analysis` |
| `live_telemetry_sessions.summary->'rankedEligibility'->>'queueId'` | `live_telemetry_sessions` |
| `live_telemetry_snapshots.payload->>'queueId'`, only when every keyframe agrees | `live_telemetry_sessions` |
| the owning session's verified queue | `matches` (Companion) |
| `match_metrics.raw->'proAnalysis'->>'queueId'` | `matches` (Riot sync) |
| a linked `op_match_analysis` row's verified queue | `matches` |

It never assumes 420. A blanket backfill would re-admit normal, flex and ARAM games into Ranked Solo/Duo progression — the precise thing the ranked-only work set out to stop. Rows with no evidence keep NULL and stay excluded, which is the documented intent: *"NULL is unverified; only 420 qualifies for Solo/Duo progression."*

Every statement is NULL-guarded, so it is re-runnable and never overwrites a `queue_id` that is already set.

## Audit — run this first, and keep the output

```sql
select 'matches' as tbl, count(*) as rows,
       count(queue_id) as have_queue,
       count(*) filter (where queue_id = 420) as ranked_solo,
       count(*) filter (where queue_id is null) as unverified
  from public.matches
union all
select 'op_match_analysis', count(*), count(queue_id),
       count(*) filter (where queue_id = 420),
       count(*) filter (where queue_id is null)
  from public.op_match_analysis
union all
select 'live_telemetry_sessions', count(*), count(queue_id),
       count(*) filter (where queue_id = 420),
       count(*) filter (where queue_id is null)
  from public.live_telemetry_sessions;
```

Then preview how much evidence actually exists, without writing anything:

```sql
select 'analysis payload' as source,
       count(*) filter (where jsonb_typeof(analysis->'queueId') = 'number') as recoverable,
       count(*) filter (where (analysis->>'queueId')::int = 420
                          and jsonb_typeof(analysis->'queueId') = 'number') as would_be_420
  from public.op_match_analysis
 where queue_id is null
union all
select 'session summary',
       count(*) filter (where jsonb_typeof(summary->'rankedEligibility'->'queueId') = 'number'),
       count(*) filter (where (summary->'rankedEligibility'->>'queueId')::int = 420
                          and jsonb_typeof(summary->'rankedEligibility'->'queueId') = 'number')
  from public.live_telemetry_sessions
 where queue_id is null;
```

Run the audit again afterwards and compare. If `unverified` stays high, that is the honest answer — those games cannot be proved to be Ranked Solo, and the product decision is what to show those users, not how to relabel their rows.

## Schema drift

`matches.live_session_id` is used throughout the application but appears in no migration in this repository, so it was added to the live database by hand. The draft guards that step with an `information_schema` check rather than assuming it. Worth reconciling the migrations with the live schema separately — other columns may be missing too.

## Status: production has deployed the filtering

Confirmed on 26 October 2026. `GET /api/release/manifest` on opclimb.com returns `rankedFocus` and `companionVersion: 0.12.0`; the 16 October build had neither (`companionVersion: 0.11.9`, no `rankedFocus`). The Cloudflare Workers build went green on `main` at 2026-10-25T12:36Z, about fifty minutes after the migration was applied at 11:45.

So this is no longer a pre-deploy decision. All 32 `.eq('queue_id',420)` call sites are strict equality — no `.or(...)`, no `is null` tolerance — so every game recorded before the migration is already invisible to Climb Plan, coach trends, the Decision Twin, the learning journey, the player plan and the DNA baseline.

### How much is hidden right now

```sql
select 'matches' as tbl,
       count(*) filter (where queue_id = 420)  as visible_now,
       count(*) filter (where queue_id is null) as hidden_now,
       count(distinct user_id) filter (where queue_id is null) as users_with_hidden,
       max(created_at) filter (where queue_id is null) as newest_hidden
  from public.matches
union all
select 'op_match_analysis',
       count(*) filter (where queue_id = 420),
       count(*) filter (where queue_id is null),
       count(distinct user_id) filter (where queue_id is null),
       max(created_at) filter (where queue_id is null)
  from public.op_match_analysis;
```

The DNA baseline needs three games, so anyone below that is back to collecting a baseline:

```sql
select count(*) filter (where visible = 0) as users_fully_blank,
       count(*) filter (where visible < 3) as users_back_to_baseline,
       count(*)                            as users_total
  from (select user_id, count(*) filter (where queue_id = 420) as visible
          from public.matches group by user_id) t;
```

## Verification, after running the backfill

```sql
select source, table_name, count(*) as rows_written,
       count(*) filter (where queue_id = 420) as ranked_solo,
       count(*) filter (where queue_id <> 420) as other_queues
  from public.queue_id_backfill_log
 group by source, table_name
 order by rows_written desc;
```

`other_queues` is the number of games correctly identified as *not* Ranked Solo. Those rows stay hidden from progression, which is the intended outcome — not a failure.

Then re-run the two queries above and compare `visible_now` and `users_back_to_baseline` against what you recorded beforehand.

## Rollback

The log records exactly what the backfill wrote, so this undoes that and nothing else. It will not touch a `queue_id` the application wrote on a new row.

```sql
begin;

update public.matches m
   set queue_id = null
  from public.queue_id_backfill_log l
 where l.table_name = 'matches' and l.row_id = m.id and m.queue_id = l.queue_id;

update public.op_match_analysis a
   set queue_id = null
  from public.queue_id_backfill_log l
 where l.table_name = 'op_match_analysis' and l.row_id = a.id and a.queue_id = l.queue_id;

update public.live_telemetry_sessions s
   set queue_id = null
  from public.queue_id_backfill_log l
 where l.table_name = 'live_telemetry_sessions' and l.row_id = s.id and s.queue_id = l.queue_id;

delete from public.queue_id_backfill_log;

commit;
```

Keep the log table afterwards either way: it is the only record of which values were inferred rather than observed live.
