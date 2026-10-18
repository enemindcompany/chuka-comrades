begin;

-- Stores a user's chosen CPL experience, separate from authorization roles.
-- Only non-privileged account preferences may be self-selected.
create table if not exists public.cpl_account_preferences (
  firebase_uid text primary key,
  account_type text not null check (account_type in ('fan','player','team_manager','referee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cpl_account_preferences enable row level security;
drop policy if exists "CPL users read own account preference" on public.cpl_account_preferences;
create policy "CPL users read own account preference" on public.cpl_account_preferences
  for select to authenticated using (firebase_uid = (auth.jwt()->>'sub'));
drop policy if exists "CPL users create own account preference" on public.cpl_account_preferences;
create policy "CPL users create own account preference" on public.cpl_account_preferences
  for insert to authenticated with check (firebase_uid = (auth.jwt()->>'sub'));
drop policy if exists "CPL users update own account preference" on public.cpl_account_preferences;
create policy "CPL users update own account preference" on public.cpl_account_preferences
  for update to authenticated using (firebase_uid = (auth.jwt()->>'sub'))
  with check (firebase_uid = (auth.jwt()->>'sub'));

-- This table is not linked to cpl_user_roles. Therefore a selected preference
-- cannot create a chairman, secretary, referee, or manager authorization.
commit;
