-- OP CLIMB 50-player beta hardening
-- Shared telemetry gate + durable post-game queue.

create schema if not exists private;

create table if not exists private.telemetry_ingest_windows (
  device_id uuid not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (device_id, window_start)
);

create table if not exists private.telemetry_sample_claims (
  device_id uuid not null,
  client_session_id text not null,
  sample_bucket bigint not null,
  claimed_at timestamptz not null default now(),
  primary key (device_id, client_session_id, sample_bucket)
);

revoke all on private.telemetry_ingest_windows from public, anon, authenticated;
revoke all on private.telemetry_sample_claims from public, anon, authenticated;

create or replace function public.claim_live_telemetry_ingest(
  p_device_id uuid,
  p_client_session_id text,
  p_is_snapshot boolean,
  p_limit integer default 30,
  p_window_seconds integer default 60,
  p_sample_seconds integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer := 0;
  v_bucket bigint := null;
  v_sample_accepted boolean := true;
  v_rows integer := 0;
begin
  if p_device_id is null or p_client_session_id is null or length(trim(p_client_session_id))=0 then
    return jsonb_build_object('allowed',false,'sampleAccepted',false,'reason','INVALID_INPUT');
  end if;
  v_window_start := to_timestamp(floor(extract(epoch from v_now)/p_window_seconds)*p_window_seconds);

  insert into private.telemetry_ingest_windows(device_id,window_start,request_count,updated_at)
  values(p_device_id,v_window_start,1,v_now)
  on conflict(device_id,window_start)
  do update set request_count=private.telemetry_ingest_windows.request_count+1,updated_at=v_now
  returning request_count into v_count;

  if v_count>p_limit then
    return jsonb_build_object('allowed',false,'sampleAccepted',false,'reason','RATE_LIMIT','count',v_count,'limit',p_limit);
  end if;

  if p_is_snapshot then
    v_bucket := floor(extract(epoch from v_now)/p_sample_seconds)::bigint;
    insert into private.telemetry_sample_claims(device_id,client_session_id,sample_bucket,claimed_at)
    values(p_device_id,p_client_session_id,v_bucket,v_now)
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    v_sample_accepted := v_rows=1;
  end if;

  return jsonb_build_object(
    'allowed',true,
    'sampleAccepted',v_sample_accepted,
    'reason',case when p_is_snapshot and not v_sample_accepted then 'SAMPLE_ALREADY_CLAIMED' else 'OK' end,
    'count',v_count,
    'limit',p_limit,
    'sampleBucket',v_bucket
  );
end;
$$;

revoke all on function public.claim_live_telemetry_ingest(uuid,text,boolean,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_live_telemetry_ingest(uuid,text,boolean,integer,integer,integer) to service_role;

create table if not exists public.live_postgame_jobs (
  id bigint generated always as identity primary key,
  session_id uuid not null unique references public.live_telemetry_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz null,
  locked_by text null,
  last_error text null,
  payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

alter table public.live_postgame_jobs enable row level security;
revoke all on public.live_postgame_jobs from anon, authenticated;
grant all on public.live_postgame_jobs to service_role;

create index if not exists live_postgame_jobs_ready_idx
  on public.live_postgame_jobs(status,available_at,created_at)
  where status in ('PENDING','PROCESSING');

create index if not exists live_postgame_jobs_user_idx
  on public.live_postgame_jobs(user_id);

create or replace function public.claim_live_postgame_jobs(p_worker_id text,p_limit integer default 12)
returns setof public.live_postgame_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with ready as (
    select j.id
    from public.live_postgame_jobs j
    where (j.status='PENDING' and j.available_at<=now())
       or (j.status='PROCESSING' and j.locked_at<now()-interval '10 minutes')
    order by j.created_at
    for update skip locked
    limit greatest(1,least(p_limit,50))
  )
  update public.live_postgame_jobs j
  set status='PROCESSING',attempts=j.attempts+1,locked_at=now(),locked_by=p_worker_id,updated_at=now()
  from ready
  where j.id=ready.id
  returning j.*;
end;
$$;

revoke all on function public.claim_live_postgame_jobs(text,integer) from public, anon, authenticated;
grant execute on function public.claim_live_postgame_jobs(text,integer) to service_role;

create or replace function public.finish_live_postgame_job(p_job_id bigint,p_ok boolean,p_error text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempts integer;
begin
  select attempts into v_attempts from public.live_postgame_jobs where id=p_job_id for update;
  if not found then return; end if;

  if p_ok then
    update public.live_postgame_jobs
    set status='COMPLETE',completed_at=now(),locked_at=null,locked_by=null,last_error=null,payload=null,updated_at=now()
    where id=p_job_id;
  else
    update public.live_postgame_jobs
    set status=case when v_attempts>=5 then 'FAILED' else 'PENDING' end,
        available_at=case when v_attempts>=5 then available_at else now()+make_interval(mins=>least(30,power(2,greatest(v_attempts-1,0))::int)) end,
        locked_at=null,
        locked_by=null,
        last_error=left(coalesce(p_error,'Unknown post-game processing error'),2000),
        updated_at=now()
    where id=p_job_id;
  end if;
end;
$$;

revoke all on function public.finish_live_postgame_job(bigint,boolean,text) from public, anon, authenticated;
grant execute on function public.finish_live_postgame_job(bigint,boolean,text) to service_role;
