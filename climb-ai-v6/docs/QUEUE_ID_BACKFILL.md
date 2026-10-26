# queue_id backfill — audit before applying

`20261025114503_ranked_solo_only.sql` added `queue_id` to `matches`, `op_match_analysis` and `live_telemetry_sessions` and left every existing row NULL. Since PR #249 the application reads history through `.eq('queue_id',420)` in 24 files, and NULL never matches 420.

**The timing is the risk.** The migration is applied to production, but the code that depends on it is not: opclimb.com has served the 16 October build since the Cloudflare deploy pipeline broke. Nothing looks wrong today. The first successful deploy is the one where Climb Plan, coach trends, the Decision Twin, the learning journey and the DNA baseline all begin filtering on 420 and find NULL on every historical row — every user's history reads as empty, and the DNA baseline restarts from zero games.

Decide this backfill **before** unblocking the deploy, not after.

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
