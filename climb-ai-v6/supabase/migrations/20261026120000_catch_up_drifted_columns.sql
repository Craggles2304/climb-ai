-- Bring the migrations folder back in line with the live database.
--
-- These eight columns are read and written by the application but are created
-- by no migration in this repository, so they were added to production by hand.
-- Production already has them: every statement here is `if not exists`, so this
-- migration is a no-op there. It exists so that a database built from these
-- migrations alone -- a local dev setup, a staging environment, a restore --
-- produces a schema the application can actually run against.
--
-- Types were taken from how the code writes each column, not guessed:
--   matches.live_session_id                        lib/server/liveTrackerRepository.ts:412
--   op_player_learning_profiles.learning_identity   lib/server/proLearningRepository.ts:181
--   op_player_learning_profiles.mastered_behaviours lib/server/proLearningRepository.ts:182
--   op_player_learning_profiles.current_focus       lib/server/proLearningRepository.ts:183
--   op_player_learning_profiles.recent_change       lib/server/proLearningRepository.ts:184
--   live_tracker_devices.tracker_status             lib/server/liveTrackerPairingRepository.ts:50
--   live_tracker_devices.tracker_status_updated_at  lib/server/liveTrackerPairingRepository.ts:51
--   riot_accounts.observed_riot_id                  lib/server/activationBootstrap.ts:150
--
-- Columns are left nullable with no NOT NULL constraint: production rows
-- already hold values, and a NOT NULL backfill is a separate decision from
-- recording the schema. Defaults match the sibling jsonb columns on each table.

-- The Companion links a saved match back to the recording it came from.
alter table public.matches
  add column if not exists live_session_id uuid;

-- Queried directly in liveReadRepository.ts:80 and companion-review/route.ts:199.
create index if not exists matches_live_session_idx
  on public.matches(live_session_id)
  where live_session_id is not null;

-- The Decision Twin: identity, mastered behaviours, current limiter and the
-- most recent change, all stored as objects by proLearningRepository.
alter table public.op_player_learning_profiles
  add column if not exists learning_identity jsonb default '{}'::jsonb;
alter table public.op_player_learning_profiles
  add column if not exists mastered_behaviours jsonb default '[]'::jsonb;
alter table public.op_player_learning_profiles
  add column if not exists current_focus jsonb default '{}'::jsonb;
alter table public.op_player_learning_profiles
  add column if not exists recent_change jsonb default '{}'::jsonb;

-- Companion heartbeat: the tracker's reported state ({state, pairing, ...})
-- and when it last changed.
alter table public.live_tracker_devices
  add column if not exists tracker_status jsonb default '{}'::jsonb;
alter table public.live_tracker_devices
  add column if not exists tracker_status_updated_at timestamptz;

-- The Riot ID actually observed in game, used to verify the paired account.
alter table public.riot_accounts
  add column if not exists observed_riot_id text;

-- Deliberately not added: a foreign key from matches.live_session_id to
-- live_telemetry_sessions(id). The column already exists in production, so the
-- statement above no-ops there and a constraint added here would exist only in
-- fresh databases -- new drift, in the opposite direction. Adding it to
-- production needs an orphan-row check first and belongs in its own change.
