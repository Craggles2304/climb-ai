create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email_normalized text,
  cohort int not null default 1 check (cohort between 1 and 999),
  status text not null default 'PENDING' check (status in ('PENDING','CLAIMED','REVOKED','EXPIRED')),
  expires_at timestamptz not null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint beta_invite_claim_pair check (
    (status='CLAIMED' and claimed_by is not null and claimed_at is not null)
    or status<>'CLAIMED'
  )
);

create index if not exists beta_invites_status_expiry_idx
  on public.beta_invites(status, expires_at);
create index if not exists beta_invites_cohort_created_idx
  on public.beta_invites(cohort, created_at desc);
create index if not exists beta_invites_email_idx
  on public.beta_invites(email_normalized)
  where email_normalized is not null;

create table if not exists public.beta_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invite_id uuid unique references public.beta_invites(id) on delete set null,
  cohort int not null check (cohort between 1 and 999),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','COMPLETED','REMOVED')),
  joined_at timestamptz not null default now(),
  status_updated_at timestamptz not null default now(),
  notes text
);

create index if not exists beta_testers_cohort_status_idx
  on public.beta_testers(cohort, status, joined_at desc);

create table if not exists public.beta_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('BUG','FRICTION','COACHING')),
  severity text not null check (severity in ('BLOCKER','HIGH','MEDIUM','LOW')),
  surface text not null,
  summary text not null check (char_length(summary) between 3 and 240),
  details text,
  build_commit text,
  web_version text,
  status text not null default 'OPEN' check (status in ('OPEN','REVIEWING','RESOLVED','WONT_FIX')),
  resolution_note text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists beta_reports_triage_idx
  on public.beta_reports(status, severity, created_at desc);
create index if not exists beta_reports_user_created_idx
  on public.beta_reports(user_id, created_at desc);

alter table public.beta_invites enable row level security;
alter table public.beta_testers enable row level security;
alter table public.beta_reports enable row level security;

revoke all on table public.beta_invites from anon, authenticated;
revoke all on table public.beta_testers from anon, authenticated;
revoke all on table public.beta_reports from anon, authenticated;
grant select, insert, update, delete on table public.beta_invites to service_role;
grant select, insert, update, delete on table public.beta_testers to service_role;
grant select, insert, update, delete on table public.beta_reports to service_role;

drop policy if exists "beta_invites_no_client_access" on public.beta_invites;
create policy "beta_invites_no_client_access" on public.beta_invites
for all to anon, authenticated using (false) with check (false);

drop policy if exists "beta_testers_no_client_access" on public.beta_testers;
create policy "beta_testers_no_client_access" on public.beta_testers
for all to anon, authenticated using (false) with check (false);

drop policy if exists "beta_reports_no_client_access" on public.beta_reports;
create policy "beta_reports_no_client_access" on public.beta_reports
for all to anon, authenticated using (false) with check (false);

create or replace function public.claim_beta_invite(
  p_token_hash text,
  p_user_id uuid,
  p_email text
) returns table(invite_id uuid, cohort int)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_invite public.beta_invites%rowtype;
  v_email text:=lower(trim(coalesce(p_email,'')));
begin
  select * into v_invite
  from public.beta_invites
  where token_hash=p_token_hash
  for update;

  if not found then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if v_invite.status<>'PENDING' then
    raise exception 'INVITE_NOT_AVAILABLE';
  end if;

  if v_invite.expires_at<=now() then
    update public.beta_invites set status='EXPIRED' where id=v_invite.id;
    raise exception 'INVITE_EXPIRED';
  end if;

  if v_invite.email_normalized is not null
     and lower(v_invite.email_normalized)<>v_email then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  insert into public.beta_testers(user_id,invite_id,cohort,status,joined_at,status_updated_at)
  values(p_user_id,v_invite.id,v_invite.cohort,'ACTIVE',now(),now())
  on conflict(user_id) do update set
    invite_id=excluded.invite_id,
    cohort=excluded.cohort,
    status='ACTIVE',
    status_updated_at=now();

  update public.beta_invites
  set status='CLAIMED',claimed_by=p_user_id,claimed_at=now()
  where id=v_invite.id;

  return query select v_invite.id,v_invite.cohort;
end;
$$;

revoke all on function public.claim_beta_invite(text,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_beta_invite(text,uuid,text) to service_role;
