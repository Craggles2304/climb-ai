-- OP CLIMB: retain an append-only audit of every saved League mission.
-- Existing ilp_tasks remains the authoritative *current* mission state.
-- This archive prevents the 12-note / 20-match UI history windows from
-- permanently erasing older progress when a snapshot is later overwritten.
-- No existing table/record is deleted or modified.

create table if not exists public.player_mission_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid not null,
  mission_id text not null,
  product text not null default 'LOL' check (product in ('LOL','TFT')),
  event_type text not null check (event_type in ('STATE','NOTE','ATTEMPT','CLIMB_SESSION')),
  event_key text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  constraint player_mission_history_unique unique(user_id,riot_account_id,mission_id,event_type,event_key)
);

create index if not exists player_mission_history_account_timeline_idx
  on public.player_mission_history(user_id,riot_account_id,id desc);
create index if not exists player_mission_history_mission_timeline_idx
  on public.player_mission_history(user_id,riot_account_id,mission_id,id desc);

alter table public.player_mission_history enable row level security;
-- History is written only through trusted database triggers. Browser clients
-- can read their own rows, but may not insert/update/delete archive records.
revoke all on table public.player_mission_history from anon, authenticated;
grant select on table public.player_mission_history to authenticated;
drop policy if exists player_mission_history_read_own on public.player_mission_history;
create policy player_mission_history_read_own on public.player_mission_history
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.capture_ilp_mission_history()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  note jsonb;
  attempt jsonb;
begin
  if tg_op = 'UPDATE' then
    if new.payload is not distinct from old.payload then
      return new;
    end if;
  end if;

  insert into public.player_mission_history
    (user_id,riot_account_id,mission_id,product,event_type,event_key,payload,occurred_at)
  values
    (new.user_id,new.riot_account_id,new.id,'LOL','STATE',
      'state:' || md5(new.payload::text),
      new.payload,coalesce(new.updated_at,now()))
  on conflict (user_id,riot_account_id,mission_id,event_type,event_key) do nothing;

  for note in select value from jsonb_array_elements(
    case when jsonb_typeof(new.payload->'history') = 'array'
      then new.payload->'history' else '[]'::jsonb end
  ) loop
    insert into public.player_mission_history
      (user_id,riot_account_id,mission_id,product,event_type,event_key,payload,occurred_at)
    values
      (new.user_id,new.riot_account_id,new.id,'LOL','NOTE',
        'note:' || md5(note::text),
        note,coalesce(new.updated_at,now()))
    on conflict (user_id,riot_account_id,mission_id,event_type,event_key) do nothing;
  end loop;

  for attempt in select value from jsonb_array_elements(
    case when jsonb_typeof(new.payload->'missionHistory') = 'array'
      then new.payload->'missionHistory' else '[]'::jsonb end
  ) loop
    insert into public.player_mission_history
      (user_id,riot_account_id,mission_id,product,event_type,event_key,payload,occurred_at)
    values
      (new.user_id,new.riot_account_id,new.id,'LOL','ATTEMPT',
        'attempt:' || md5(attempt::text),
        attempt,coalesce(new.updated_at,now()))
    on conflict (user_id,riot_account_id,mission_id,event_type,event_key) do nothing;
  end loop;
  return new;
end;
$$;

revoke all on function public.capture_ilp_mission_history() from public, anon, authenticated;
drop trigger if exists ilp_tasks_capture_mission_history on public.ilp_tasks;
create trigger ilp_tasks_capture_mission_history
  after insert or update of payload on public.ilp_tasks
  for each row execute function public.capture_ilp_mission_history();

-- A Climb Session and its completion are also part of mission history.
create or replace function public.capture_climb_session_history()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op='UPDATE' then
    if new.status is not distinct from old.status
      and new.completed_at is not distinct from old.completed_at then
      return new;
    end if;
  end if;
  insert into public.player_mission_history
    (user_id,riot_account_id,mission_id,product,event_type,event_key,payload,occurred_at)
  values
    (new.user_id,new.riot_account_id,new.mission_id,'LOL','CLIMB_SESSION',
     'session:' || new.id::text || ':' || new.status,
     jsonb_build_object('sessionId',new.id,'status',new.status,
       'missionSnapshot',new.mission_snapshot,'targetGames',new.target_games,
       'startedAt',new.started_at,'completedAt',new.completed_at),
     coalesce(new.completed_at,new.started_at,now()))
  on conflict (user_id,riot_account_id,mission_id,event_type,event_key) do nothing;
  return new;
end;
$$;
revoke all on function public.capture_climb_session_history() from public, anon, authenticated;
drop trigger if exists op_climb_sessions_capture_history on public.op_climb_sessions;
create trigger op_climb_sessions_capture_history
  after insert or update of status,completed_at on public.op_climb_sessions
  for each row execute function public.capture_climb_session_history();

-- Backfill current saved snapshots and their surviving history.
-- We cannot recreate already-overwritten historical entries that were never
-- previously retained. All new writes are captured from this migration on.
insert into public.player_mission_history
 (user_id,riot_account_id,mission_id,product,event_type,event_key,payload,occurred_at)
select user_id,riot_account_id,id,'LOL','STATE','state:'||md5(payload::text),payload,coalesce(updated_at,now())
from public.ilp_tasks
on conflict (user_id,riot_account_id,mission_id,event_type,event_key) do nothing;

insert into public.player_mission_history
 (user_id,riot_account_id,mission_id,product,event_type,event_key,payload,occurred_at)
select t.user_id,t.riot_account_id,t.id,'LOL','NOTE',
 'note:'||md5(e.value::text),e.value,coalesce(t.updated_at,now())
from public.ilp_tasks t
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(t.payload->'history')='array' then t.payload->'history' else '[]'::jsonb end
) as e(value)
on conflict (user_id,riot_account_id,mission_id,event_type,event_key) do nothing;

insert into public.player_mission_history
 (user_id,riot_account_id,mission_id,product,event_type,event_key,payload,occurred_at)
select t.user_id,t.riot_account_id,t.id,'LOL','ATTEMPT',
 'attempt:'||md5(e.value::text),e.value,coalesce(t.updated_at,now())
from public.ilp_tasks t
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(t.payload->'missionHistory')='array' then t.payload->'missionHistory' else '[]'::jsonb end
) as e(value)
on conflict (user_id,riot_account_id,mission_id,event_type,event_key) do nothing;

insert into public.player_mission_history
 (user_id,riot_account_id,mission_id,product,event_type,event_key,payload,occurred_at)
select s.user_id,s.riot_account_id,s.mission_id,'LOL','CLIMB_SESSION',
 'session:'||s.id::text||':'||s.status,
 jsonb_build_object('sessionId',s.id,'status',s.status,'missionSnapshot',s.mission_snapshot,
  'targetGames',s.target_games,'startedAt',s.started_at,'completedAt',s.completed_at),
 coalesce(s.completed_at,s.started_at,now())
from public.op_climb_sessions s
on conflict (user_id,riot_account_id,mission_id,event_type,event_key) do nothing;

comment on table public.player_mission_history is
 'Append-only history of League mission state revisions, notes, tracked attempts and Climb Sessions. No direct client writes; only its owner may read it.';
