# CLIMB//AI V6 — Adaptive ILP + Live Companion foundation

V6 turns the Individual Learning Plan into the main intelligence layer.

## New in V6
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
