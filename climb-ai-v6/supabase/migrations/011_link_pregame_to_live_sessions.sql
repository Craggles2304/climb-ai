-- Associate the most recent local champ-select record with the live match that
-- starts immediately afterwards. live_telemetry_sessions.device_id is text in
-- the original schema, while live_tracker_devices.id is uuid, so comparison is
-- deliberately text-to-text inside the trigger.

alter table public.live_pregame_contexts
  add column if not exists linked_session_id uuid references public.live_telemetry_sessions(id) on delete set null;

create index if not exists live_pregame_linked_session_idx
  on public.live_pregame_contexts(linked_session_id);

create or replace function public.op_link_recent_pregame_to_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_pregame_contexts
     set linked_session_id = new.id,
         ended_at = coalesce(ended_at, new.started_at)
   where id = (
     select p.id
       from public.live_pregame_contexts p
      where p.user_id = new.user_id
        and p.account_key = new.account_key
        and p.device_id::text = new.device_id
        and p.linked_session_id is null
        and p.started_at <= new.started_at + interval '2 minutes'
        and p.started_at >= new.started_at - interval '30 minutes'
      order by p.started_at desc
      limit 1
   );
  return new;
end;
$$;

drop trigger if exists op_link_pregame_after_live_session_insert on public.live_telemetry_sessions;
create trigger op_link_pregame_after_live_session_insert
after insert on public.live_telemetry_sessions
for each row execute function public.op_link_recent_pregame_to_session();
