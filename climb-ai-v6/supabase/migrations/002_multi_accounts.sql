-- CLIMB//AI v4: one app user can own multiple Riot accounts.
alter table public.riot_accounts add column if not exists label text default 'ACCOUNT';
alter table public.riot_accounts add column if not exists is_primary boolean default false;
alter table public.riot_accounts add column if not exists sync_status text default 'pending';
alter table public.riot_accounts add column if not exists last_synced_at timestamptz;
alter table public.riot_accounts add column if not exists rank_tier text;
alter table public.riot_accounts add column if not exists rank_division text;
alter table public.riot_accounts add column if not exists league_points int;

alter table public.matches add column if not exists riot_account_id uuid references public.riot_accounts(id) on delete cascade;
alter table public.missions add column if not exists riot_account_id uuid references public.riot_accounts(id) on delete cascade;
alter table public.analysis_reports add column if not exists riot_account_id uuid references public.riot_accounts(id) on delete cascade;
alter table public.improvement_scores add column if not exists riot_account_id uuid references public.riot_accounts(id) on delete cascade;
alter table public.weekly_reports add column if not exists riot_account_id uuid references public.riot_accounts(id) on delete cascade;
alter table public.champion_stats add column if not exists riot_account_id uuid references public.riot_accounts(id) on delete cascade;

create index if not exists idx_matches_riot_account on public.matches(riot_account_id, occurred_at desc);
create index if not exists idx_missions_riot_account on public.missions(riot_account_id, active);
create index if not exists idx_analysis_riot_account on public.analysis_reports(riot_account_id, created_at desc);

-- User ownership remains enforced through user_id RLS; riot_account_id is an additional partition key.
