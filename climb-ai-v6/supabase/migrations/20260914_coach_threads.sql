create table if not exists public.coach_threads (
  user_id uuid not null references auth.users(id) on delete cascade,
  riot_account_id uuid not null references public.riot_accounts(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, riot_account_id),
  constraint coach_threads_messages_array check (jsonb_typeof(messages) = 'array')
);

alter table public.coach_threads enable row level security;

revoke all on table public.coach_threads from anon;
grant select, insert, update, delete on table public.coach_threads to authenticated;

drop policy if exists own_coach_threads on public.coach_threads;
create policy own_coach_threads
on public.coach_threads
for all
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.riot_accounts ra
    where ra.id = riot_account_id
      and ra.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.riot_accounts ra
    where ra.id = riot_account_id
      and ra.user_id = (select auth.uid())
  )
);

create index if not exists coach_threads_updated_idx
on public.coach_threads(user_id, updated_at desc);
