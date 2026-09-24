alter table public.op_player_learning_profiles
  add column if not exists role_profiles jsonb not null default '{}'::jsonb;

create index if not exists op_player_learning_profiles_role_profiles_gin
  on public.op_player_learning_profiles using gin (role_profiles jsonb_path_ops);

comment on column public.op_player_learning_profiles.role_profiles is
  'Role-aware League learning stacks keyed by canonical role (TOP/JUNGLE/MID/ADC/SUPPORT). Global cross-role learning remains in the main profile.';
