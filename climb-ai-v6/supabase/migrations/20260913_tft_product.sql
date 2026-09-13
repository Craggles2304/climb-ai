-- TFT is a separate OP CLIMB product surface. It shares Riot identity, but not
-- League rank/history or subscription entitlement.

create table if not exists public.product_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('LOL','TFT')),
  tier text not null default 'FREE' check (tier in ('FREE','PLUS','PRO')),
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','inactive')),
  source text not null default 'system',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product)
);

alter table public.product_entitlements enable row level security;
grant select on table public.product_entitlements to authenticated;
grant all on table public.product_entitlements to service_role;
drop policy if exists "Users read own product entitlements" on public.product_entitlements;
create policy "Users read own product entitlements"
  on public.product_entitlements for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.tft_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid not null references public.riot_accounts(id) on delete cascade,
  puuid text,
  rank_tier text,
  rank_division text,
  league_points integer,
  sync_status text not null default 'pending',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, riot_account_id)
);

alter table public.tft_profiles enable row level security;
grant select on table public.tft_profiles to authenticated;
grant all on table public.tft_profiles to service_role;
drop policy if exists "Users read own TFT profile" on public.tft_profiles;
create policy "Users read own TFT profile"
  on public.tft_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.tft_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid not null references public.riot_accounts(id) on delete cascade,
  external_match_id text not null,
  queue_id integer,
  game_datetime timestamptz,
  game_length_seconds integer,
  game_version text,
  set_number integer,
  set_core_name text,
  placement integer not null check (placement between 1 and 8),
  level integer,
  last_round integer,
  players_eliminated integer,
  total_damage_to_players integer,
  gold_left integer,
  augments jsonb not null default '[]'::jsonb,
  traits jsonb not null default '[]'::jsonb,
  units jsonb not null default '[]'::jsonb,
  companion jsonb,
  comp_signature text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_match_id)
);

create index if not exists tft_matches_user_date_idx
  on public.tft_matches(user_id, game_datetime desc);
create index if not exists tft_matches_account_date_idx
  on public.tft_matches(riot_account_id, game_datetime desc);

alter table public.tft_matches enable row level security;
grant select on table public.tft_matches to authenticated;
grant all on table public.tft_matches to service_role;
drop policy if exists "Users read own TFT matches" on public.tft_matches;
create policy "Users read own TFT matches"
  on public.tft_matches for select
  to authenticated
  using ((select auth.uid()) = user_id);
