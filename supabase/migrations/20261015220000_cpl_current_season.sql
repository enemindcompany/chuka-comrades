-- CPL integration for the existing Chuka Comrades PWA.
-- Apply this migration in the linked Supabase project before using the CPL data screens.
create extension if not exists pgcrypto;

create table if not exists public.cpl_teams (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  name text not null,
  league text not null check (league in ('A','B')),
  played integer not null default 0 check (played >= 0),
  won integer not null default 0 check (won >= 0),
  drawn integer not null default 0 check (drawn >= 0),
  lost integer not null default 0 check (lost >= 0),
  gf integer not null default 0 check (gf >= 0),
  ga integer not null default 0 check (ga >= 0),
  points integer not null default 0 check (points >= 0),
  notes text,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season, name)
);

create table if not exists public.cpl_fixtures (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  home_team text not null,
  away_team text not null,
  home_team_id uuid references public.cpl_teams(id) on delete set null,
  away_team_id uuid references public.cpl_teams(id) on delete set null,
  match_date timestamptz,
  venue text,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','report_submitted','pending_approval','approved','postponed','abandoned','replay_required','invalid')),
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  leg text not null default 'second_leg',
  competition text not null default 'League',
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cpl_squad_requests (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  team_id uuid not null references public.cpl_teams(id) on delete restrict,
  full_name text not null,
  position text,
  shirt_number text,
  firebase_uid text not null,
  email text,
  status text not null default 'pending_manager_approval' check (status in ('pending_manager_approval','approved','rejected','pending_league_review','registered','suspended')),
  fee_amount numeric(10,2) not null default 0 check (fee_amount = 0),
  manager_reviewed_by text,
  manager_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cpl_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  player_name text not null,
  from_team_id uuid not null references public.cpl_teams(id) on delete restrict,
  to_team_id uuid not null references public.cpl_teams(id) on delete restrict,
  reason text,
  requested_by_uid text not null,
  requested_by_email text,
  player_approved boolean not null default false,
  releasing_team_approved boolean not null default false,
  receiving_team_approved boolean not null default false,
  chairman_status text not null default 'pending' check (chairman_status in ('pending','approved','rejected','returned_for_correction')),
  status text not null default 'pending_player_approval',
  requested_at timestamptz not null default now(),
  player_approved_at timestamptz,
  releasing_team_approved_at timestamptz,
  receiving_team_approved_at timestamptz,
  chairman_approved_by text,
  chairman_approved_at timestamptz,
  historical_note text,
  check (from_team_id <> to_team_id)
);

create table if not exists public.cpl_match_reports (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  fixture_id uuid not null references public.cpl_fixtures(id) on delete restrict,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  event_notes text,
  submitted_by_uid text not null,
  submitted_by_email text,
  status text not null default 'pending_chairman_approval' check (status in ('pending_chairman_approval','returned_for_correction','approved','rejected')),
  chairman_note text,
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cpl_audit_log (
  id bigint generated always as identity primary key,
  season text not null default '2026',
  actor_email text,
  action text not null,
  record_type text not null,
  record_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.cpl_teams enable row level security;
alter table public.cpl_fixtures enable row level security;
alter table public.cpl_squad_requests enable row level security;
alter table public.cpl_transfer_requests enable row level security;
alter table public.cpl_match_reports enable row level security;
alter table public.cpl_audit_log enable row level security;

-- Public read-only league data. Private requests/reports are not publicly readable.
drop policy if exists "CPL teams public read" on public.cpl_teams;
create policy "CPL teams public read" on public.cpl_teams for select using (true);
drop policy if exists "CPL fixtures public read" on public.cpl_fixtures;
create policy "CPL fixtures public read" on public.cpl_fixtures for select using (true);

-- Initial CPL admin. This is an email-based temporary bootstrap; final ownership transfer should
-- be performed by a trusted server-side admin workflow, not by editing this client-side constant.
drop policy if exists "CPL bootstrap admin manages teams" on public.cpl_teams;
create policy "CPL bootstrap admin manages teams" on public.cpl_teams for all
  using (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');
drop policy if exists "CPL bootstrap admin manages fixtures" on public.cpl_fixtures;
create policy "CPL bootstrap admin manages fixtures" on public.cpl_fixtures for all
  using (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');

-- Users can submit only records tied to their Firebase identity. Approval is kept separate.
drop policy if exists "Users create own CPL squad requests" on public.cpl_squad_requests;
create policy "Users create own CPL squad requests" on public.cpl_squad_requests for insert
  with check (firebase_uid = auth.jwt() ->> 'sub' and fee_amount = 0 and status = 'pending_manager_approval');
drop policy if exists "Users read own CPL squad requests" on public.cpl_squad_requests;
create policy "Users read own CPL squad requests" on public.cpl_squad_requests for select
  using (firebase_uid = auth.jwt() ->> 'sub' or lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');
drop policy if exists "CPL admin manages squad requests" on public.cpl_squad_requests;
create policy "CPL admin manages squad requests" on public.cpl_squad_requests for update
  using (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');

drop policy if exists "Users create own CPL transfer requests" on public.cpl_transfer_requests;
create policy "Users create own CPL transfer requests" on public.cpl_transfer_requests for insert
  with check (requested_by_uid = auth.jwt() ->> 'sub' and chairman_status = 'pending' and player_approved = false);
drop policy if exists "Users read own CPL transfer requests" on public.cpl_transfer_requests;
create policy "Users read own CPL transfer requests" on public.cpl_transfer_requests for select
  using (requested_by_uid = auth.jwt() ->> 'sub' or lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');
drop policy if exists "CPL admin reviews transfers" on public.cpl_transfer_requests;
create policy "CPL admin reviews transfers" on public.cpl_transfer_requests for update
  using (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');

drop policy if exists "Authenticated users submit match reports" on public.cpl_match_reports;
create policy "Authenticated users submit match reports" on public.cpl_match_reports for insert
  with check (submitted_by_uid = auth.jwt() ->> 'sub' and status = 'pending_chairman_approval');
drop policy if exists "Report submitters and admin read reports" on public.cpl_match_reports;
create policy "Report submitters and admin read reports" on public.cpl_match_reports for select
  using (submitted_by_uid = auth.jwt() ->> 'sub' or lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');
drop policy if exists "CPL admin reviews match reports" on public.cpl_match_reports;
create policy "CPL admin reviews match reports" on public.cpl_match_reports for update
  using (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');

drop policy if exists "CPL admin reads audit log" on public.cpl_audit_log;
create policy "CPL admin reads audit log" on public.cpl_audit_log for select
  using (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');
drop policy if exists "CPL admin inserts audit log" on public.cpl_audit_log;
create policy "CPL admin inserts audit log" on public.cpl_audit_log for insert
  with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com');

comment on table public.cpl_teams is 'CPL season-specific team records; do not seed invented standings.';
comment on table public.cpl_fixtures is 'Verified CPL fixtures and official approved results only.';
comment on table public.cpl_squad_requests is 'Current season squad joining is free; fee_amount must remain zero.';
comment on table public.cpl_transfer_requests is 'Transfer requests require player consent, team approvals, and chairman final approval.';
comment on table public.cpl_match_reports is 'Referee reports remain pending until chairman approval.';
