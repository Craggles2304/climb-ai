alter table public.matches drop constraint if exists matches_source_check;
alter table public.matches add constraint matches_source_check check (source = any (array['manual'::text,'screenshot'::text,'riot'::text,'demo'::text,'live_tracker'::text,'LIVE_TRACKER'::text]));
alter table public.matches drop constraint if exists matches_result_check;
alter table public.matches add constraint matches_result_check check (result = any (array['WIN'::text,'LOSS'::text,'UNKNOWN'::text]));

alter table public.riot_accounts add column if not exists role text;
alter table public.riot_accounts add column if not exists champions jsonb not null default '[]'::jsonb;
alter table public.riot_accounts add column if not exists frustration text;

create table if not exists public.ilp_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid not null references public.riot_accounts(id) on delete cascade,
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, riot_account_id, id)
);
alter table public.ilp_tasks enable row level security;
drop policy if exists own_ilp_tasks on public.ilp_tasks;
create policy own_ilp_tasks on public.ilp_tasks for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists ilp_tasks_riot_account_idx on public.ilp_tasks(riot_account_id, updated_at desc);
create index if not exists matches_user_riot_occurred_idx on public.matches(user_id, riot_account_id, occurred_at desc);
