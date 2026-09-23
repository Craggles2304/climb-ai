create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_id text,
  session_id text,
  useful boolean not null,
  surface text,
  subject text,
  reason text,
  details text,
  rank_band text,
  role text,
  created_at timestamptz not null default now()
);

alter table public.feedback
  alter column user_id drop not null;

alter table public.feedback
  add column if not exists anon_id text,
  add column if not exists session_id text,
  add column if not exists surface text,
  add column if not exists subject text,
  add column if not exists rank_band text,
  add column if not exists role text,
  add column if not exists reason text,
  add column if not exists details text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists feedback_surface_useful_idx
  on public.feedback(surface, useful);
create index if not exists feedback_user_created_idx
  on public.feedback(user_id, created_at desc)
  where user_id is not null;
create index if not exists feedback_anon_created_idx
  on public.feedback(anon_id, created_at desc)
  where anon_id is not null;

alter table public.feedback enable row level security;

revoke all on table public.feedback from anon, authenticated;
grant select, insert, update, delete on table public.feedback to service_role;
