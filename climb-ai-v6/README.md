# OVERPOWERED — League improvement platform

Play a game. Find the one thing holding you back. Fix it next game.

## What this build contains
- Adaptive five-task ILP. Match evidence updates progress/status instead of leaving tasks static.
- Tasks accumulate mastery evidence and can move to MASTERED.
- Coach recommendations can add a new task; if five are already active the lowest-priority task is paused rather than creating an endless list.
- Coach answers explicitly link advice back to the ILP.
- Live Companion page and local Windows companion prototype skeleton.
- Live mode is designed for silent permitted telemetry + post-game adaptation, not automated shotcalling.
- New `/api/live/telemetry` validation route.

## Demo limitations
- Demo matches remain local mock data.
- ILP adaptation persists in browser localStorage until Supabase is connected.
- The companion skeleton is not a signed Windows app and has no production authentication/device pairing yet.
- Google OAuth requires Supabase + Google provider configuration.
- Current champion builds still require a legitimate current-patch data integration before they should be called "best".

## Deploy
Set Vercel Root Directory to `climb-ai-v6`.

Next.js is pinned to 15.5.24, the patched version already used successfully in earlier deployments.

## V7 — real Riot ingestion + Development HQ / Player Development Centre

### What is real now
- `lib/riot/mapMatch.ts` turns a Riot MATCH-V5 match **plus its timeline** into the
  existing internal `Match` model. Pure function, 12 tests (`npm test`).
- `lib/services/riotService.ts` has a working `LiveRiotService` (account lookup,
  ranked tier, recent ranked match ids, match + timeline, Data Dragon item data)
  swapped against `DisabledRiotService` by the `RIOT_API_ENABLED` flag.
- `POST /api/riot/sync` resolves a Riot ID, pulls recent ranked games, maps them,
  and optionally persists. `GET` reports flag state; the dashboard reads it.
- `lib/server/matchRepository.ts` writes matches + metrics to Supabase, idempotent
  on the Riot match id. Degrades to "not persisted" when Supabase is unconfigured.
- `supabase/migrations/004_riot_timeline_metrics.sql` adds the timeline-derived
  columns the ILP engine scores on, a uniqueness index, and RLS owner policies.

### Turning Riot sync on
1. Put a working key in `RIOT_API_KEY` and set `RIOT_API_ENABLED=true`.
   A personal development key expires every 24 hours; production access needs a
   Riot application review.
2. Optionally set `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and run
   the migrations to persist. Without them, sync still works and returns matches.
3. `curl -X POST localhost:3000/api/riot/sync -H 'content-type: application/json' \
   -d '{"gameName":"YourName","tagline":"EUW","region":"EUW"}'`

### Metrics honesty
`mapRiotMatch` never invents a value. Anything it cannot derive is left undefined
and named in `unavailable`, which is stored in `match_metrics.unavailable_metrics`.
Item timings only appear when a Data Dragon completed-item list is available;
`objectiveParticipation`, `soloDeaths` and `teamfightDeaths` are documented
inferences, not Riot-provided facts.

### Known gaps
- Auth, billing and storage services are still stubs.
- `adaptILP` still runs client-side against demo matches; wiring it to the synced
  Supabase rows is the next step.
- The jungle economy curve is not built — that card says so rather than showing a
  lane split that means nothing for the role.
