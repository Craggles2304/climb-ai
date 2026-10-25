# TFT evidence and shared account mission

TFT's website and paired Companion now read one account-scoped development endpoint, `/api/tft/current-mission`. At recording START the server snapshots that mission into the session. Completed telemetry sessions contribute their captured observations to the same view as official/manual match history.

## What the grading means

- Placement, final level and leftover gold are outcome context. They do not score Economy, Tempo or any other skill.
- All six strands accept an explained player review: round, helped/hurt/uncertain verdict and reason. Board Building and Items & Augments no longer have disconnected score placeholders.
- Scores are the percentage of explained player reviews marked helpful, labelled **self-reported**. Unknown/uncertain reviews remain ungraded. The UI shows coverage rather than an invented probability of correctness.
- Recorded actions support post-game review. They do not prove optimal decisions. Three recorded games mean the mission has material to review; they never award verified mastery, XP or skill transfer.
- Reviews of a Companion session can only name a round that was actually recorded. Match/session ownership is checked before privileged database reads and writes.
- Repeated START/POINT/END uploads do not create duplicate progress or erase an existing review. Multi-game telemetry reads explicitly page beyond PostgREST's default row cap.

Existing scoreboard-only games will show unknown skill grades until explained reviews are available. The original match data is retained. No database schema migration or secret change is needed.

## Validation

- Behaviour tests: results alone do not grade, six self-review domains, unknown evidence, repeated games, mission snapshots and safe review payloads.
- Route/repository fixture flow: START → points → END → website/Companion mission → self-review → DNA; empty sessions, repeat uploads, cross-user/account requests and multi-page checkpoint reads.
- Existing Companion/overlay/TFT recorder regressions; TypeScript and production build.

The fixture flow is not a real Windows capture test. Live account, database and installed Companion verification still require an authenticated test game after rollout.
