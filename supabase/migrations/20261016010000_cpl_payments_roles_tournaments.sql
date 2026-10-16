begin;

-- Official payment destinations are deliberately unset until the chairman verifies them.
alter table public.cpl_seasons add column if not exists mpesa_till_number text;
alter table public.cpl_seasons add column if not exists mpesa_paybill_number text;
alter table public.cpl_seasons add column if not exists mpesa_account_reference text;

create table if not exists public.cpl_tournaments (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  title text not null,
  description text,
  poster_url text,
  starts_at timestamptz,
  expires_at timestamptz not null,
  status text not null default 'published' check (status in ('draft','published','expired')),
  created_by_uid text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cpl_tournaments_expiry_idx on public.cpl_tournaments(expires_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cpl-tournament-posters', 'cpl-tournament-posters', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "CPL tournament posters public read" on storage.objects;
create policy "CPL tournament posters public read" on storage.objects for select using (bucket_id = 'cpl-tournament-posters');
drop policy if exists "CPL admin upload tournament posters" on storage.objects;
create policy "CPL admin upload tournament posters" on storage.objects for insert to authenticated with check (bucket_id = 'cpl-tournament-posters' and (public.cpl_is_admin() or public.cpl_is_chairman()));
drop policy if exists "CPL admin delete tournament posters" on storage.objects;
create policy "CPL admin delete tournament posters" on storage.objects for delete to authenticated using (bucket_id = 'cpl-tournament-posters' and (public.cpl_is_admin() or public.cpl_is_chairman()));

create table if not exists public.cpl_tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.cpl_tournaments(id) on delete cascade,
  entry_type text not null default 'registration',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.cpl_tournaments enable row level security;
alter table public.cpl_tournament_entries enable row level security;
drop policy if exists "CPL tournaments public active read" on public.cpl_tournaments;
create policy "CPL tournaments public active read" on public.cpl_tournaments for select using (status = 'published' and expires_at > now());
drop policy if exists "CPL admin manage tournaments" on public.cpl_tournaments;
create policy "CPL admin manage tournaments" on public.cpl_tournaments for all using (public.cpl_is_admin() or public.cpl_is_chairman()) with check (public.cpl_is_admin() or public.cpl_is_chairman());
drop policy if exists "CPL admin manage tournament entries" on public.cpl_tournament_entries;
create policy "CPL admin manage tournament entries" on public.cpl_tournament_entries for all using (public.cpl_is_admin() or public.cpl_is_chairman()) with check (public.cpl_is_admin() or public.cpl_is_chairman());

-- When an expired tournament row is removed, also remove its poster from the dedicated bucket.
create or replace function public.cpl_delete_tournament_poster()
returns trigger language plpgsql security definer set search_path = public, storage, pg_temp as $$
declare object_path text;
begin
  if old.poster_url is not null and old.poster_url like '%/cpl-tournament-posters/%' then
    object_path := split_part(old.poster_url, '/cpl-tournament-posters/', 2);
    delete from storage.objects where bucket_id = 'cpl-tournament-posters' and name = object_path;
  end if;
  return old;
end;
$$;
drop trigger if exists cpl_tournament_delete_poster on public.cpl_tournaments;
create trigger cpl_tournament_delete_poster before delete on public.cpl_tournaments for each row execute function public.cpl_delete_tournament_poster();

-- Explicit cleanup removes expired tournament records and all dependent entries.
create or replace function public.cpl_cleanup_expired_tournaments()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare removed_count integer;
begin
  if not (public.cpl_is_admin() or public.cpl_is_chairman()) then
    raise exception 'Only CPL administrators or the chairman may run cleanup';
  end if;
  delete from public.cpl_tournaments where expires_at <= now();
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;
revoke all on function public.cpl_cleanup_expired_tournaments() from public, anon;
grant execute on function public.cpl_cleanup_expired_tournaments() to authenticated;

-- If pg_cron is enabled on this Supabase project, run cleanup daily. Expired public listings are hidden by RLS even without cron.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cpl-expired-tournament-cleanup';
    perform cron.schedule('cpl-expired-tournament-cleanup', '15 2 * * *', $job$delete from public.cpl_tournaments where expires_at <= now();$job$);
  end if;
exception when undefined_table or undefined_function then null;
end $$;

commit;
