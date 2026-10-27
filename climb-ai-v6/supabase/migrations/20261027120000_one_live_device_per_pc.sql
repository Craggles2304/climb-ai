-- One live tracker device row per PC.
--
-- Pairing inserted a row every time a code was requested and never retired the
-- previous live row, so a user accumulated dozens of rows for one machine, each
-- with a valid token. Whichever token the Companion still held decided which
-- Riot account its games were filed under, which is how recorded games ended up
-- under the wrong account.
--
-- This retires the superseded rows and adds the constraint that keeps them from
-- coming back. Safe to run more than once.

-- 1. Retire every live row that is not the most recently used one for its PC.
--    Nothing is deleted: a retired row keeps its history and its telemetry, it
--    simply stops authenticating, exactly as a revoked device does.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, device_name
      order by last_seen_at desc nulls last, created_at desc, id desc
    ) as position
  from public.live_tracker_devices
  where revoked_at is null
)
update public.live_tracker_devices as devices
set
  revoked_at = now(),
  tracker_status = jsonb_build_object(
    'state', 'REPLACED',
    'pairing', false,
    'replacedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'replacedBy', 'MIGRATION_20261027120000'
  ),
  tracker_status_updated_at = now()
from ranked
where devices.id = ranked.id
  and ranked.position > 1;

-- 2. Retire unclaimed pairing codes that expired. These were already revoked,
--    so they authenticate nothing, but they are what made the table unreadable.
update public.live_tracker_devices
set tracker_status = jsonb_set(tracker_status, '{pairing}', 'false'::jsonb)
where revoked_at is not null
  and tracker_status->>'pairing' = 'true'
  and tracker_status->>'expiresAt' is not null
  and (tracker_status->>'expiresAt')::timestamptz < now();

-- 3. Stop it happening again. Pending pairing rows carry revoked_at, so they
--    are outside this index and a player can still request a new code while a
--    device is live.
create unique index if not exists live_tracker_devices_one_live_per_device_idx
  on public.live_tracker_devices (user_id, device_name)
  where revoked_at is null;
