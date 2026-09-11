-- Align the repository with the hardened hosted Supabase live-tracking schema.
-- This migration is idempotent and safe after 003_adaptive_ilp_live.sql + 007_live_tracker_pairing.sql.

alter table public.live_tracker_devices enable row level security;
alter table public.live_telemetry_sessions enable row level security;
alter table public.live_telemetry_snapshots enable row level security;
alter table public.matches enable row level security;
alter table public.match_metrics enable row level security;

drop policy if exists "users own tracker devices" on public.live_tracker_devices;
create policy "users own tracker devices"
  on public.live_tracker_devices
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users own live sessions" on public.live_telemetry_sessions;
create policy "users own live sessions"
  on public.live_telemetry_sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users own live snapshots" on public.live_telemetry_snapshots;
create policy "users own live snapshots"
  on public.live_telemetry_snapshots
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.live_telemetry_sessions s
      where s.id = session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.live_telemetry_sessions s
      where s.id = session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "users own matches" on public.matches;
create policy "users own matches"
  on public.matches
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users own match metrics" on public.match_metrics;
create policy "users own match metrics"
  on public.match_metrics
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists live_tracker_devices_user_idx
  on public.live_tracker_devices(user_id,created_at desc);

create index if not exists matches_user_id_idx
  on public.matches(user_id);

create index if not exists match_metrics_user_id_idx
  on public.match_metrics(user_id);

-- Realtime publication is useful for future push-based UI updates. The current
-- tracker UI can continue to poll the authenticated API, so enabling this does
-- not change client behaviour by itself.
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='live_telemetry_sessions'
    ) then
      execute 'alter publication supabase_realtime add table public.live_telemetry_sessions';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='live_telemetry_snapshots'
    ) then
      execute 'alter publication supabase_realtime add table public.live_telemetry_snapshots';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='live_tracker_devices'
    ) then
      execute 'alter publication supabase_realtime add table public.live_tracker_devices';
    end if;
  end if;
end
$$;
