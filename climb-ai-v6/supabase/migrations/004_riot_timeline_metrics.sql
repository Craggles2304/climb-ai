-- CLIMB//AI — timeline-derived metrics from Riot MATCH-V5.
--
-- These are the columns the adaptive ILP engine actually scores on. They live as
-- real columns (not only inside match_metrics.raw) because the engine filters and
-- averages across them, and jsonb predicates on every read would not hold up.
--
-- Every column is nullable on purpose: a match without a timeline still stores,
-- and an uncomputable metric is recorded as NULL rather than a fabricated zero.

alter table public.match_metrics
  add column if not exists lane_cs_per_min      numeric,
  add column if not exists post15_cs_per_min    numeric,
  add column if not exists cs_at_10             int,
  add column if not exists cs_at_15             int,
  add column if not exists gold_diff_at_15      int,
  add column if not exists xp_diff_at_15        int,
  add column if not exists deaths_pre_10        int,
  add column if not exists deaths_10_to_20      int,
  add column if not exists deaths_post_20       int,
  add column if not exists solo_deaths          int,
  add column if not exists teamfight_deaths     int,
  add column if not exists first_item_minute    numeric,
  add column if not exists second_item_minute   numeric,
  add column if not exists third_item_minute    numeric,
  add column if not exists damage_share         numeric,
  -- Metric keys the mapper could not derive for this match, so the UI can say
  -- "unavailable" instead of showing a misleading zero.
  add column if not exists unavailable_metrics  jsonb not null default '[]'::jsonb;

-- Re-syncing the same Riot match must never duplicate a row.
create unique index if not exists matches_user_external_match_idx
  on public.matches(user_id, external_match_id)
  where external_match_id is not null;

-- The ILP engine always reads "this account's recent matches, newest first".
create index if not exists matches_user_occurred_idx
  on public.matches(user_id, occurred_at desc);

alter table public.match_metrics enable row level security;
alter table public.matches       enable row level security;

drop policy if exists "match_metrics_owner" on public.match_metrics;
create policy "match_metrics_owner" on public.match_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "matches_owner" on public.matches;
create policy "matches_owner" on public.matches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
