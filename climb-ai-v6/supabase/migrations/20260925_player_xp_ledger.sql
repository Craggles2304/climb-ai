-- Durable account XP ledger for OP CLIMB progression.
-- Server code derives transactions from persisted ILP mission evidence and
-- upserts deterministic transaction keys, so refreshes cannot duplicate XP.

create table if not exists public.player_xp_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid references public.riot_accounts(id) on delete cascade,
  transaction_key text not null,
  mission_id text,
  match_id text,
  kind text not null check (kind in ('MISSION_REP','MISSION_MASTERED')),
  xp integer not null check (xp > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, transaction_key)
);

create index if not exists player_xp_ledger_user_created_idx
  on public.player_xp_ledger(user_id, created_at desc);

create index if not exists player_xp_ledger_match_idx
  on public.player_xp_ledger(user_id, match_id)
  where match_id is not null;

alter table public.player_xp_ledger enable row level security;

drop policy if exists own_player_xp_ledger_select on public.player_xp_ledger;
create policy own_player_xp_ledger_select
  on public.player_xp_ledger
  for select
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.player_xp_ledger from anon, authenticated;
grant select on public.player_xp_ledger to authenticated;
