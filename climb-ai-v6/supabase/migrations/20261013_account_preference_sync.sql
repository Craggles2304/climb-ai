-- Persist the preferred Riot account per authenticated user so account switching
-- follows their login on a different browser or PC.
-- Existing profiles keep their current primary account as the fallback.
alter table public.profiles
  add column if not exists selected_riot_account_id uuid
  references public.riot_accounts(id) on delete set null;

comment on column public.profiles.selected_riot_account_id
  is 'Preferred linked Riot account for cross-device UI restoration. Always validate ownership against riot_accounts.user_id before use.';
