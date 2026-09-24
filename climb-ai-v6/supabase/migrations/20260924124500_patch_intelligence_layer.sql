create table if not exists public.lol_patches (
  patch text primary key,
  data_dragon_version text not null unique,
  major integer not null,
  minor integer not null,
  build integer,
  source text not null default 'RIOT_DATA_DRAGON',
  is_current boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ingested_at timestamptz,
  champion_count integer not null default 0,
  item_count integer not null default 0,
  rune_count integer not null default 0,
  summoner_count integer not null default 0,
  previous_patch text,
  metadata jsonb not null default '{}'::jsonb,
  constraint lol_patches_patch_format check (patch ~ '^[0-9]+\.[0-9]+$')
);
create unique index if not exists lol_patches_one_current_idx on public.lol_patches ((is_current)) where is_current = true;
create index if not exists lol_patches_seen_idx on public.lol_patches (last_seen_at desc);

create table if not exists public.lol_patch_entities (
  patch text not null references public.lol_patches(patch) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  entity_name text,
  fingerprint text not null,
  payload jsonb not null,
  changed_from_previous boolean not null default false,
  change_summary jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (patch, entity_type, entity_id),
  constraint lol_patch_entities_type_check check (entity_type in ('CHAMPION','ITEM','RUNE','SUMMONER'))
);
create index if not exists lol_patch_entities_lookup_idx on public.lol_patch_entities (entity_type, entity_id, patch);
create index if not exists lol_patch_entities_changed_idx on public.lol_patch_entities (patch, entity_type) where changed_from_previous = true;

create table if not exists public.lol_patch_changes (
  id bigint generated always as identity primary key,
  patch text not null references public.lol_patches(patch) on delete cascade,
  previous_patch text,
  entity_type text not null,
  entity_id text not null,
  entity_name text,
  change_type text not null,
  before_fingerprint text,
  after_fingerprint text,
  changed_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint lol_patch_changes_type_check check (entity_type in ('CHAMPION','ITEM','RUNE','SUMMONER')),
  constraint lol_patch_changes_change_check check (change_type in ('ADDED','REMOVED','MODIFIED')),
  unique (patch, entity_type, entity_id)
);
create index if not exists lol_patch_changes_entity_idx on public.lol_patch_changes (entity_type, entity_id, patch);

alter table public.matches add column if not exists patch text, add column if not exists game_version text, add column if not exists patch_source text not null default 'UNKNOWN', add column if not exists patch_observed_at timestamptz;
create index if not exists matches_patch_idx on public.matches (patch, occurred_at desc);
alter table public.op_match_analysis add column if not exists patch text, add column if not exists game_version text, add column if not exists patch_context jsonb not null default '{}'::jsonb;
create index if not exists op_match_analysis_patch_idx on public.op_match_analysis (patch, created_at desc);
alter table public.op_player_learning_profiles add column if not exists patch_context jsonb not null default '{}'::jsonb;
alter table public.live_telemetry_sessions add column if not exists patch text, add column if not exists game_version text, add column if not exists patch_source text not null default 'UNKNOWN';
alter table public.live_pregame_contexts add column if not exists patch text, add column if not exists game_version text, add column if not exists patch_source text not null default 'UNKNOWN';

alter table public.lol_patches enable row level security;
alter table public.lol_patch_entities enable row level security;
alter table public.lol_patch_changes enable row level security;
revoke all on table public.lol_patches from anon, authenticated;
revoke all on table public.lol_patch_entities from anon, authenticated;
revoke all on table public.lol_patch_changes from anon, authenticated;
grant select,insert,update,delete on table public.lol_patches to service_role;
grant select,insert,update,delete on table public.lol_patch_entities to service_role;
grant select,insert,update,delete on table public.lol_patch_changes to service_role;
grant usage,select on sequence public.lol_patch_changes_id_seq to service_role;
