-- CPL profiles, payment instructions, and time-limited tournaments.
begin;

create table if not exists public.cpl_profile_roles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  role text not null check (role in ('fan','player','team_manager','referee','secretary','chairman','initial_admin')),
  team_id uuid null references public.cpl_teams(id) on delete set null,
  active boolean not null default true,
  assigned_by_uid text,
  created_at timestamptz not null default now(),
  unique(firebase_uid, role, team_id)
);
alter table public.cpl_profile_roles enable row level security;
drop policy if exists "CPL profile roles self read" on public.cpl_profile_roles;
create policy "CPL profile roles self read" on public.cpl_profile_roles for select to authenticated using (firebase_uid = (auth.jwt()->>'sub') or public.cpl_is_admin());
drop policy if exists "CPL profile roles admin manage" on public.cpl_profile_roles;
create policy "CPL profile roles admin manage" on public.cpl_profile_roles for all to authenticated using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());

-- Allow a single account to hold multiple backend-enforced roles.
alter table public.cpl_user_roles drop constraint if exists cpl_user_roles_pkey;
alter table public.cpl_user_roles add constraint cpl_user_roles_pkey primary key (firebase_uid, role);

-- Keep security-enforced role assignments in the existing authorization table.
create or replace function public.cpl_sync_profile_role_to_authorization()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.active and new.role in ('chairman','secretary','team_manager','referee','player') then
    insert into public.cpl_user_roles(firebase_uid, role, assigned_by_uid, assigned_at, updated_at)
    values(new.firebase_uid, new.role, new.assigned_by_uid, now(), now())
    on conflict(firebase_uid, role) do update set assigned_by_uid=excluded.assigned_by_uid, updated_at=now();
  end if;
  return new;
end; $$;
drop trigger if exists cpl_sync_profile_role_to_authorization on public.cpl_profile_roles;
create trigger cpl_sync_profile_role_to_authorization after insert or update of active, role on public.cpl_profile_roles
for each row execute function public.cpl_sync_profile_role_to_authorization();

create table if not exists public.cpl_payment_settings (
  singleton boolean primary key default true check (singleton),
  till_number text,
  paybill_number text,
  account_reference text not null default 'CPL',
  account_name text not null default 'Chuka Premier League',
  payment_instructions text,
  updated_by_uid text,
  updated_at timestamptz not null default now()
);
insert into public.cpl_payment_settings(singleton) values(true) on conflict(singleton) do nothing;
alter table public.cpl_payment_settings enable row level security;
drop policy if exists "CPL payment settings public read" on public.cpl_payment_settings;
create policy "CPL payment settings public read" on public.cpl_payment_settings for select using (true);
drop policy if exists "CPL payment settings chairman manage" on public.cpl_payment_settings;
create policy "CPL payment settings chairman manage" on public.cpl_payment_settings for all to authenticated using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());

create table if not exists public.cpl_tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_path text,
  image_url text,
  starts_at timestamptz,
  expires_at timestamptz not null,
  status text not null default 'active' check(status in ('active','expired')),
  created_by_uid text not null,
  created_at timestamptz not null default now(),
  expired_at timestamptz,
  constraint cpl_tournament_expiry_after_creation check (expires_at > created_at)
);
create index if not exists cpl_tournaments_expiry_idx on public.cpl_tournaments(expires_at) where status='active';
alter table public.cpl_tournaments enable row level security;
drop policy if exists "CPL active tournaments public read" on public.cpl_tournaments;
create policy "CPL active tournaments public read" on public.cpl_tournaments for select using (status='active' and expires_at > now() or public.cpl_is_admin());
drop policy if exists "CPL officials create tournaments" on public.cpl_tournaments;
create policy "CPL officials create tournaments" on public.cpl_tournaments for insert to authenticated with check (public.cpl_is_chairman() and created_by_uid=(auth.jwt()->>'sub'));
drop policy if exists "CPL chairman manage tournaments" on public.cpl_tournaments;
create policy "CPL chairman manage tournaments" on public.cpl_tournaments for update to authenticated using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());
drop policy if exists "CPL chairman delete tournaments" on public.cpl_tournaments;
create policy "CPL chairman delete tournaments" on public.cpl_tournaments for delete to authenticated using (public.cpl_is_chairman());

-- Database rows expire/delete automatically when pg_cron is available. Storage objects are
-- queued separately so an operator can verify image cleanup rather than silently orphan files.
create table if not exists public.cpl_tournament_image_cleanup_queue (
  id bigint generated always as identity primary key,
  image_path text not null unique,
  queued_at timestamptz not null default now()
);
alter table public.cpl_tournament_image_cleanup_queue enable row level security;
drop policy if exists "CPL cleanup queue admin read" on public.cpl_tournament_image_cleanup_queue;
create policy "CPL cleanup queue admin read" on public.cpl_tournament_image_cleanup_queue for select to authenticated using (public.cpl_is_admin());

create or replace function public.cpl_cleanup_expired_tournaments()
returns integer language plpgsql security definer set search_path=public as $$
declare removed_count integer;
begin
  insert into public.cpl_tournament_image_cleanup_queue(image_path)
    select image_path from public.cpl_tournaments where expires_at <= now() and image_path is not null
    on conflict(image_path) do nothing;
  delete from public.cpl_tournaments where expires_at <= now();
  get diagnostics removed_count = row_count;
  return removed_count;
end; $$;
revoke all on function public.cpl_cleanup_expired_tournaments() from public, anon, authenticated;
grant execute on function public.cpl_cleanup_expired_tournaments() to service_role;

-- Public-read image bucket; uploads and removals are chairman-only. Bucket creation is idempotent.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('cpl-tournament-images','cpl-tournament-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists "CPL tournament images public view" on storage.objects;
create policy "CPL tournament images public view" on storage.objects for select using (bucket_id='cpl-tournament-images');
drop policy if exists "CPL chairman upload tournament images" on storage.objects;
create policy "CPL chairman upload tournament images" on storage.objects for insert to authenticated with check (bucket_id='cpl-tournament-images' and public.cpl_is_chairman());
drop policy if exists "CPL chairman update tournament images" on storage.objects;
create policy "CPL chairman update tournament images" on storage.objects for update to authenticated using (bucket_id='cpl-tournament-images' and public.cpl_is_chairman()) with check (bucket_id='cpl-tournament-images' and public.cpl_is_chairman());
drop policy if exists "CPL chairman delete tournament images" on storage.objects;
create policy "CPL chairman delete tournament images" on storage.objects for delete to authenticated using (bucket_id='cpl-tournament-images' and public.cpl_is_chairman());

commit;
