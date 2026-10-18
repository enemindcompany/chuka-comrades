-- CPL workflow hardening and automation. Idempotent so it can be safely applied after the initial CPL migration.
create extension if not exists pgcrypto;

-- Configurable season and competition rules; no current-season records are reset.
create table if not exists public.cpl_seasons (
  season text primary key,
  name text not null,
  current_leg text not null default 'second_leg' check (current_leg in ('first_leg','second_leg','playoffs','completed')),
  is_current boolean not null default false,
  squad_joining_fee numeric(10,2) not null default 0 check (squad_joining_fee >= 0),
  player_registration_fee numeric(10,2) not null default 0 check (player_registration_fee >= 0),
  match_card_fee numeric(10,2) not null default 100 check (match_card_fee >= 0),
  referee_fee_per_team_match numeric(10,2) not null default 200 check (referee_fee_per_team_match >= 0),
  transfers_open boolean not null default false,
  points_win integer not null default 3 check (points_win >= 0),
  points_draw integer not null default 1 check (points_draw >= 0),
  points_loss integer not null default 0 check (points_loss >= 0),
  tiebreakers jsonb not null default '["goal_difference","goals_scored","head_to_head"]'::jsonb,
  updated_by_uid text,
  updated_at timestamptz not null default now()
);
insert into public.cpl_seasons (season, name, current_leg, is_current, squad_joining_fee)
values ('2026', 'CPL 2026', 'second_leg', true, 0)
on conflict (season) do nothing;
update public.cpl_seasons set is_current=true where season='2026' and not exists (select 1 from public.cpl_seasons where is_current);
create unique index if not exists cpl_only_one_current_season on public.cpl_seasons(is_current) where is_current;

create table if not exists public.cpl_system_settings (
  singleton boolean primary key default true check (singleton),
  bootstrap_admin_enabled boolean not null default true,
  chairman_uid text,
  updated_at timestamptz not null default now()
);
insert into public.cpl_system_settings (singleton, bootstrap_admin_enabled)
values (true, true) on conflict (singleton) do nothing;

create table if not exists public.cpl_user_roles (
  firebase_uid text primary key,
  email text,
  role text not null check (role in ('chairman','secretary','team_manager','referee','player','former_admin')),
  assigned_by_uid text,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.cpl_is_chairman()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.cpl_user_roles r
    where r.firebase_uid = (auth.jwt() ->> 'sub') and r.role = 'chairman'
  ) or (
    coalesce((select s.bootstrap_admin_enabled from public.cpl_system_settings s where s.singleton), false)
    and lower(coalesce(auth.jwt() ->> 'email','')) = 'sidneywafula30@gmail.com'
  );
$$;

create or replace function public.cpl_is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.cpl_is_chairman() or exists (
    select 1 from public.cpl_user_roles r
    where r.firebase_uid = (auth.jwt() ->> 'sub') and r.role = 'secretary'
  );
$$;

create or replace function public.cpl_has_role(required_role text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.cpl_user_roles r
    where r.firebase_uid = (auth.jwt() ->> 'sub') and r.role = required_role)
    or (required_role = 'chairman' and public.cpl_is_chairman());
$$;

create or replace function public.cpl_set_current_season(p_season text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.cpl_is_chairman() then raise exception 'Only the chairman can change the current CPL season'; end if;
  if not exists(select 1 from public.cpl_seasons where season = p_season) then raise exception 'Create/configure this season before making it current'; end if;
  update public.cpl_seasons set is_current=false, updated_at=now() where is_current;
  update public.cpl_seasons set is_current=true, updated_by_uid=auth.jwt() ->> 'sub', updated_at=now() where season=p_season;
  insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
  values(p_season,auth.jwt() ->> 'email','current_season_changed','season',p_season,jsonb_build_object('current_season',p_season));
  return true;
end; $$;

create or replace function public.cpl_create_season(p_season text, p_name text, p_current_leg text default 'first_leg', p_make_current boolean default false)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare source public.cpl_seasons%rowtype;
begin
  if not public.cpl_is_chairman() then raise exception 'Only the chairman can create a CPL season'; end if;
  if p_season is null or length(trim(p_season)) < 4 or p_name is null or length(trim(p_name)) < 3 then raise exception 'Enter a season code and display name'; end if;
  if p_current_leg not in ('first_leg','second_leg','playoffs','completed') then raise exception 'Invalid season stage'; end if;
  if exists(select 1 from public.cpl_seasons where season=trim(p_season)) then raise exception 'That season already exists'; end if;
  select * into source from public.cpl_seasons where is_current limit 1;
  if p_make_current then update public.cpl_seasons set is_current=false, updated_at=now() where is_current; end if;
  insert into public.cpl_seasons(season,name,current_leg,is_current,squad_joining_fee,player_registration_fee,match_card_fee,referee_fee_per_team_match,transfers_open,points_win,points_draw,points_loss,tiebreakers,updated_by_uid)
  values(trim(p_season),trim(p_name),p_current_leg,p_make_current,coalesce(source.squad_joining_fee,0),coalesce(source.player_registration_fee,0),coalesce(source.match_card_fee,100),coalesce(source.referee_fee_per_team_match,200),false,coalesce(source.points_win,3),coalesce(source.points_draw,1),coalesce(source.points_loss,0),coalesce(source.tiebreakers,'["goal_difference","goals_scored","head_to_head"]'::jsonb),auth.jwt() ->> 'sub');
  insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
  values(trim(p_season),auth.jwt() ->> 'email','season_created','season',trim(p_season),jsonb_build_object('name',trim(p_name),'current_leg',p_current_leg,'is_current',p_make_current));
  return true;
end; $$;

-- Secure two-party ownership transfer. The proposed owner must accept while signed in as themselves.
create table if not exists public.cpl_ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  previous_owner_uid text not null,
  previous_owner_email text,
  proposed_owner_uid text not null,
  proposed_owner_email text,
  status text not null default 'pending_acceptance' check (status in ('pending_acceptance','accepted','cancelled','expired')),
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by_uid text,
  check (previous_owner_uid <> proposed_owner_uid)
);

create or replace function public.cpl_request_ownership_transfer(new_owner_uid text, new_owner_email text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare transfer_id uuid; caller_uid text;
begin
  caller_uid := auth.jwt() ->> 'sub';
  if caller_uid is null or not public.cpl_is_chairman() then raise exception 'Only the current CPL chairman can transfer ownership'; end if;
  if new_owner_uid is null or length(trim(new_owner_uid)) < 3 or new_owner_uid = caller_uid then raise exception 'Choose a different existing authenticated account'; end if;
  insert into public.cpl_ownership_transfers(previous_owner_uid, previous_owner_email, proposed_owner_uid, proposed_owner_email)
  values (caller_uid, auth.jwt() ->> 'email', trim(new_owner_uid), nullif(trim(new_owner_email),'')) returning id into transfer_id;
  insert into public.cpl_audit_log(season, actor_email, action, record_type, record_id, details)
  values (coalesce((select season from public.cpl_seasons where is_current limit 1),'2026'), auth.jwt() ->> 'email', 'ownership_transfer_requested', 'ownership_transfer', transfer_id::text, jsonb_build_object('proposed_owner_uid',new_owner_uid,'proposed_owner_email',new_owner_email));
  return transfer_id;
end; $$;

create or replace function public.cpl_accept_ownership_transfer(transfer_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.cpl_ownership_transfers%rowtype;
begin
  select * into t from public.cpl_ownership_transfers where id = transfer_id for update;
  if not found then raise exception 'Transfer request not found'; end if;
  if t.status <> 'pending_acceptance' then raise exception 'Transfer request is no longer pending'; end if;
  if (auth.jwt() ->> 'sub') is null or (auth.jwt() ->> 'sub') <> t.proposed_owner_uid then raise exception 'Sign in with the account selected as the new chairman'; end if;
  update public.cpl_user_roles set role = 'former_admin', updated_at = now() where firebase_uid = t.previous_owner_uid;
  insert into public.cpl_user_roles(firebase_uid, email, role, assigned_by_uid)
  values (t.proposed_owner_uid, auth.jwt() ->> 'email', 'chairman', t.previous_owner_uid)
  on conflict (firebase_uid) do update set email = excluded.email, role = 'chairman', assigned_by_uid = excluded.assigned_by_uid, updated_at = now();
  update public.cpl_system_settings set chairman_uid = t.proposed_owner_uid, bootstrap_admin_enabled = false, updated_at = now() where singleton;
  update public.cpl_ownership_transfers set status = 'accepted', accepted_at = now(), accepted_by_uid = t.proposed_owner_uid where id = transfer_id;
  insert into public.cpl_audit_log(season, actor_email, action, record_type, record_id, details)
  values (coalesce((select season from public.cpl_seasons where is_current limit 1),'2026'), auth.jwt() ->> 'email', 'ownership_transfer_accepted', 'ownership_transfer', transfer_id::text, jsonb_build_object('previous_owner_uid',t.previous_owner_uid,'new_owner_uid',t.proposed_owner_uid));
  return true;
end; $$;

-- Team, player, manager, referee and operational records.
alter table public.cpl_transfer_requests add column if not exists player_uid text;
alter table public.cpl_teams add column if not exists short_name text;
alter table public.cpl_teams add column if not exists aliases text[] not null default '{}';
alter table public.cpl_teams add column if not exists logo_url text;
alter table public.cpl_teams add column if not exists home_ground text;
alter table public.cpl_teams add column if not exists participation_status text not null default 'active' check (participation_status in ('applicant','active','retired','suspended'));
alter table public.cpl_teams add column if not exists manager_uid text;
alter table public.cpl_teams add column if not exists manager_name text;

create table if not exists public.cpl_players (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  player_id text not null unique,
  full_name text not null,
  photo_url text,
  position text,
  shirt_number integer check (shirt_number between 1 and 99),
  current_team_id uuid references public.cpl_teams(id) on delete set null,
  season text not null default '2026',
  membership_status text not null default 'unattached' check (membership_status in ('unattached','pending','registered','suspended','released')),
  match_card_status text not null default 'pending' check (match_card_status in ('pending','active','suspended','expired')),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firebase_uid, season)
);
create index if not exists cpl_players_team_season_idx on public.cpl_players(current_team_id, season);

-- Safe public directory: excludes Firebase UIDs, emails, contact details, and payment data.
create or replace view public.cpl_public_players with (security_barrier = true) as
select p.player_id, p.full_name, p.photo_url, p.position, p.shirt_number, p.season,
       p.membership_status, p.match_card_status, t.id as team_id, t.name as team_name, t.league
from public.cpl_players p
left join public.cpl_teams t on t.id = p.current_team_id and t.season = p.season
where p.is_public = true and p.membership_status = 'registered';


create table if not exists public.cpl_team_managers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.cpl_teams(id) on delete restrict,
  season text not null default '2026',
  manager_uid text not null,
  manager_email text,
  is_active boolean not null default true,
  assigned_by_uid text,
  assigned_at timestamptz not null default now(),
  unique (team_id, season),
  unique (manager_uid, team_id, season)
);

create table if not exists public.cpl_referee_assignments (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.cpl_fixtures(id) on delete restrict,
  referee_uid text not null,
  referee_name text,
  assigned_by_uid text not null,
  assigned_at timestamptz not null default now(),
  active boolean not null default true,
  unique (fixture_id, referee_uid)
);

create table if not exists public.cpl_match_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.cpl_match_reports(id) on delete cascade,
  event_type text not null check (event_type in ('goal','assist','yellow_card','red_card','substitution','injury','incident','appearance')),
  team_id uuid references public.cpl_teams(id) on delete set null,
  player_name text not null,
  related_player_name text,
  minute integer check (minute between 0 and 150),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.cpl_match_report_revisions (
  id bigint generated always as identity primary key,
  report_id uuid not null,
  old_record jsonb not null,
  new_record jsonb not null,
  changed_by_uid text,
  changed_by_email text,
  changed_at timestamptz not null default now()
);

create table if not exists public.cpl_payments (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  payer_uid text not null,
  payer_name text,
  payment_type text not null check (payment_type in ('registration','match_card','fine','other')),
  amount numeric(10,2) not null check (amount >= 0),
  transaction_reference text,
  receipt_path text,
  status text not null default 'pending_verification' check (status in ('unpaid','pending_verification','paid','rejected','refunded')),
  verified_by_uid text,
  verified_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists cpl_payment_reference_unique on public.cpl_payments(lower(transaction_reference)) where transaction_reference is not null and trim(transaction_reference) <> '';

create table if not exists public.cpl_match_cards (
  id uuid primary key default gen_random_uuid(),
  card_number text not null unique,
  player_id uuid not null references public.cpl_players(id) on delete restrict,
  season text not null,
  issue_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending','active','suspended','expired')),
  qr_verification_token uuid not null default gen_random_uuid() unique,
  issued_by_uid text,
  created_at timestamptz not null default now(),
  unique (player_id, season)
);

create or replace view public.cpl_public_match_card_verification with (security_barrier = true) as
select c.card_number, c.season, c.issue_date, c.status, p.player_id, p.full_name, p.photo_url,
       p.position, p.shirt_number, t.name as team_name, t.league
from public.cpl_match_cards c
join public.cpl_players p on p.id = c.player_id
left join public.cpl_teams t on t.id = p.current_team_id and t.season = p.season
where c.status = 'active';

create table if not exists public.cpl_team_finance_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.cpl_teams(id) on delete restrict,
  season text not null default '2026',
  fixture_id uuid references public.cpl_fixtures(id) on delete restrict,
  entry_type text not null check (entry_type in ('expected_referee_fee','player_contribution','referee_payment','adjustment')),
  amount numeric(10,2) not null,
  player_uid text,
  player_name text,
  payment_reference text,
  receipt_path text,
  note text,
  created_by_uid text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cpl_standing_overrides (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.cpl_teams(id) on delete restrict,
  season text not null,
  field_name text not null check (field_name in ('played','won','drawn','lost','gf','ga','points')),
  override_value integer not null check (override_value >= 0),
  reason text not null,
  created_by_uid text not null,
  created_at timestamptz not null default now(),
  active boolean not null default true
);


create unique index if not exists cpl_one_active_standing_override
  on public.cpl_standing_overrides(team_id, season, field_name) where active;

create or replace function public.cpl_set_standing_override(p_team_id uuid, p_field_name text, p_override_value integer, p_reason text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare season_value text;
begin
  if not public.cpl_is_chairman() then raise exception 'Only the CPL chairman can correct official standings'; end if;
  if p_field_name not in ('played','won','drawn','lost','gf','ga','points') then raise exception 'Invalid standings field'; end if;
  if p_override_value < 0 then raise exception 'Standing values cannot be negative'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'Enter a correction reason of at least five characters'; end if;
  select season into season_value from public.cpl_teams where id = p_team_id for update;
  if season_value is null then raise exception 'Team not found'; end if;
  update public.cpl_standing_overrides set active = false where team_id = p_team_id and season = season_value and field_name = p_field_name and active;
  insert into public.cpl_standing_overrides(team_id,season,field_name,override_value,reason,created_by_uid)
  values (p_team_id,season_value,p_field_name,p_override_value,trim(p_reason),auth.jwt() ->> 'sub');
  execute format('update public.cpl_teams set %I = $1, updated_by_email = $2, updated_at = now() where id = $3', p_field_name)
    using p_override_value, auth.jwt() ->> 'email', p_team_id;
  insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
  values (season_value,auth.jwt() ->> 'email','standing_override','team',p_team_id::text,jsonb_build_object('field',p_field_name,'value',p_override_value,'reason',trim(p_reason)));
  return true;
end; $$;


-- Prevent duplicate active requests while allowing a rejected player to apply to another team.
create unique index if not exists cpl_one_active_squad_request_per_player_season
  on public.cpl_squad_requests(firebase_uid, season)
  where status in ('pending_manager_approval','pending_league_review','approved','registered');

create or replace function public.cpl_review_squad_request(p_request_id uuid, p_decision text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare q public.cpl_squad_requests%rowtype; caller_uid text; player_key text;
begin
  caller_uid := auth.jwt() ->> 'sub';
  if caller_uid is null or p_decision not in ('approved','rejected') then raise exception 'Invalid review request'; end if;
  select * into q from public.cpl_squad_requests where id = p_request_id for update;
  if not found then raise exception 'Squad request not found'; end if;
  if q.status not in ('pending_manager_approval','pending_league_review') then raise exception 'This squad request is no longer pending'; end if;
  if not public.cpl_is_chairman() and not exists (
    select 1 from public.cpl_team_managers m where m.team_id = q.team_id and m.season = q.season and m.manager_uid = caller_uid and m.is_active
    union all
    select 1 from public.cpl_teams t where t.id = q.team_id and t.manager_uid = caller_uid and t.season = q.season
  ) then raise exception 'Only the selected team manager or chairman can review this request'; end if;
  if p_decision = 'rejected' then
    update public.cpl_squad_requests set status = 'rejected', manager_reviewed_by = caller_uid, manager_reviewed_at = now() where id = p_request_id;
  else
    if exists (select 1 from public.cpl_players p where p.firebase_uid = q.firebase_uid and p.season = q.season and p.membership_status = 'registered' and p.current_team_id is distinct from q.team_id) then
      raise exception 'This player is already registered with another team. Complete an approved transfer first.';
    end if;
    player_key := 'CPL-' || q.season || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    insert into public.cpl_players(firebase_uid,player_id,full_name,position,shirt_number,current_team_id,season,membership_status,match_card_status)
    values (q.firebase_uid, player_key, q.full_name, q.position, case when coalesce(q.shirt_number,'') ~ '^[0-9]{1,2}$' then q.shirt_number::integer else null end, q.team_id, q.season, 'registered', 'pending')
    on conflict (firebase_uid, season) do update set full_name = excluded.full_name, position = excluded.position,
      shirt_number = excluded.shirt_number, current_team_id = excluded.current_team_id, membership_status = 'registered', updated_at = now();
    update public.cpl_squad_requests set status = 'registered', manager_reviewed_by = caller_uid, manager_reviewed_at = now() where id = p_request_id;
  end if;
  insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
  values (q.season,auth.jwt() ->> 'email','squad_request_' || p_decision,'squad_request',q.id::text,jsonb_build_object('team_id',q.team_id,'player_uid',q.firebase_uid));
  return true;
end; $$;

create or replace function public.cpl_assign_team_manager(p_team_id uuid, p_manager_uid text, p_manager_email text, p_manager_name text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare team_season text;
begin
  if not public.cpl_is_chairman() then raise exception 'Only the chairman can assign a team manager'; end if;
  if p_manager_uid is null or length(trim(p_manager_uid)) < 3 then raise exception 'Enter the manager Firebase UID from their existing account'; end if;
  select season into team_season from public.cpl_teams where id=p_team_id for update;
  if team_season is null then raise exception 'Team not found'; end if;
  update public.cpl_team_managers set is_active=false where team_id=p_team_id and season=team_season and is_active and manager_uid<>trim(p_manager_uid);
  insert into public.cpl_team_managers(team_id,season,manager_uid,manager_email,is_active,assigned_by_uid)
  values(p_team_id,team_season,trim(p_manager_uid),nullif(trim(p_manager_email),''),true,auth.jwt() ->> 'sub')
  on conflict(team_id,season) do update set manager_uid=excluded.manager_uid, manager_email=excluded.manager_email, is_active=true, assigned_by_uid=excluded.assigned_by_uid, assigned_at=now();
  update public.cpl_teams set manager_uid=trim(p_manager_uid), manager_name=nullif(trim(p_manager_name),''), updated_by_email=auth.jwt() ->> 'email', updated_at=now() where id=p_team_id;
  insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
  values(team_season,auth.jwt() ->> 'email','team_manager_assigned','team',p_team_id::text,jsonb_build_object('manager_uid',p_manager_uid,'manager_email',p_manager_email));
  return true;
end; $$;

create or replace function public.cpl_assign_referee(p_fixture_id uuid, p_referee_uid text, p_referee_name text default null)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare fixture_season text;
begin
  if not public.cpl_is_chairman() then raise exception 'Only the chairman can assign referees'; end if;
  if p_referee_uid is null or length(trim(p_referee_uid)) < 3 then raise exception 'Enter the referee Firebase UID from their existing account'; end if;
  select season into fixture_season from public.cpl_fixtures where id=p_fixture_id for update;
  if fixture_season is null then raise exception 'Fixture not found'; end if;
  insert into public.cpl_referee_assignments(fixture_id,referee_uid,referee_name,assigned_by_uid,active)
  values(p_fixture_id,trim(p_referee_uid),nullif(trim(p_referee_name),''),auth.jwt() ->> 'sub',true)
  on conflict(fixture_id,referee_uid) do update set referee_name=excluded.referee_name, active=true, assigned_by_uid=excluded.assigned_by_uid, assigned_at=now();
  insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
  values(fixture_season,auth.jwt() ->> 'email','referee_assigned','fixture',p_fixture_id::text,jsonb_build_object('referee_uid',p_referee_uid,'referee_name',p_referee_name));
  return true;
end; $$;

-- Transfer submissions and approvals are tied to registered player identities and verified team-manager accounts.
drop policy if exists "Users create own CPL transfer requests" on public.cpl_transfer_requests;

create or replace function public.cpl_submit_transfer(p_player_id text, p_to_team_id uuid, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.cpl_players%rowtype; destination public.cpl_teams%rowtype; caller_uid text; request_id uuid; is_manager boolean;
begin
  caller_uid := auth.jwt() ->> 'sub';
  if caller_uid is null then raise exception 'Sign in to Chuka Comrades first'; end if;
  select * into p from public.cpl_players where player_id = p_player_id and season = (select season from public.cpl_seasons where is_current limit 1) and membership_status = 'registered' for update;
  if not found then raise exception 'Choose a registered player in the current season'; end if;
  select * into destination from public.cpl_teams where id = p_to_team_id and season = p.season and participation_status = 'active';
  if not found then raise exception 'Choose an active team in the same season'; end if;
  if p.current_team_id is null or p.current_team_id = p_to_team_id then raise exception 'The player must have a different current team'; end if;
  select exists(select 1 from public.cpl_team_managers m where m.team_id = p.current_team_id and m.season = p.season and m.manager_uid = caller_uid and m.is_active)
      or exists(select 1 from public.cpl_teams t where t.id = p.current_team_id and t.manager_uid = caller_uid and t.season = p.season)
    into is_manager;
  if caller_uid <> p.firebase_uid and not is_manager and not public.cpl_is_chairman() then raise exception 'Only the player, releasing team manager, or chairman can initiate this transfer'; end if;
  if not coalesce((select s.transfers_open from public.cpl_seasons s where s.season = p.season), false) then raise exception 'The transfer window is closed'; end if;
  if exists(select 1 from public.cpl_transfer_requests r where r.player_uid = p.firebase_uid and r.season = p.season and r.status not in ('rejected','cancelled','invalid')) then raise exception 'This player already has an active transfer request'; end if;
  insert into public.cpl_transfer_requests(season,player_name,player_uid,from_team_id,to_team_id,reason,requested_by_uid,requested_by_email,player_approved,releasing_team_approved,receiving_team_approved,chairman_status,status)
  values (p.season,p.full_name,p.firebase_uid,p.current_team_id,p_to_team_id,nullif(trim(p_reason),''),caller_uid,auth.jwt() ->> 'email',caller_uid = p.firebase_uid,false,false,'pending',case when caller_uid = p.firebase_uid then 'pending_team_approval' else 'pending_player_approval' end)
  returning id into request_id;
  insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
  values (p.season,auth.jwt() ->> 'email','transfer_requested','transfer',request_id::text,jsonb_build_object('player_uid',p.firebase_uid,'from_team_id',p.current_team_id,'to_team_id',p_to_team_id));
  return request_id;
end; $$;

create or replace function public.cpl_player_approve_transfer(p_transfer_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.cpl_transfer_requests%rowtype;
begin
  select * into r from public.cpl_transfer_requests where id = p_transfer_id for update;
  if not found or r.player_uid is null or r.player_uid <> (auth.jwt() ->> 'sub') then raise exception 'Only the player named in this transfer can consent'; end if;
  if r.status in ('approved','rejected','cancelled','invalid') then raise exception 'This transfer is no longer pending'; end if;
  update public.cpl_transfer_requests set player_approved = true, player_approved_at = now(), status = case when releasing_team_approved and receiving_team_approved then 'pending_chairman_approval' else 'pending_team_approval' end where id = p_transfer_id;
  return true;
end; $$;

create or replace function public.cpl_approve_transfer_as_team_manager(p_transfer_id uuid, p_decision text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.cpl_transfer_requests%rowtype; caller_uid text; is_releasing boolean; is_receiving boolean;
begin
  caller_uid := auth.jwt() ->> 'sub';
  if p_decision not in ('approved','rejected') then raise exception 'Choose approve or reject'; end if;
  select * into r from public.cpl_transfer_requests where id = p_transfer_id for update;
  if not found then raise exception 'Transfer request not found'; end if;
  select exists(select 1 from public.cpl_team_managers m where m.team_id=r.from_team_id and m.season=r.season and m.manager_uid=caller_uid and m.is_active)
      or exists(select 1 from public.cpl_teams t where t.id=r.from_team_id and t.season=r.season and t.manager_uid=caller_uid)
    into is_releasing;
  select exists(select 1 from public.cpl_team_managers m where m.team_id=r.to_team_id and m.season=r.season and m.manager_uid=caller_uid and m.is_active)
      or exists(select 1 from public.cpl_teams t where t.id=r.to_team_id and t.season=r.season and t.manager_uid=caller_uid)
    into is_receiving;
  if not is_releasing and not is_receiving and not public.cpl_is_chairman() then raise exception 'Only the releasing or receiving team manager can approve this transfer'; end if;
  if p_decision = 'rejected' then
    update public.cpl_transfer_requests set status='rejected', chairman_status='rejected' where id=p_transfer_id;
  else
    update public.cpl_transfer_requests set
      releasing_team_approved = releasing_team_approved or is_releasing,
      receiving_team_approved = receiving_team_approved or is_receiving,
      releasing_team_approved_at = case when is_releasing then now() else releasing_team_approved_at end,
      receiving_team_approved_at = case when is_receiving then now() else receiving_team_approved_at end,
      status = case when player_approved and (releasing_team_approved or is_releasing) and (receiving_team_approved or is_receiving) then 'pending_chairman_approval' else 'pending_team_approval' end
    where id=p_transfer_id;
  end if;
  insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
  values (r.season,auth.jwt() ->> 'email','transfer_team_' || p_decision,'transfer',r.id::text,jsonb_build_object('releasing_manager',is_releasing,'receiving_manager',is_receiving));
  return true;
end; $$;

create or replace function public.cpl_finalize_approved_transfer()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare player_row public.cpl_players%rowtype;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.player_uid is null or not new.player_approved or not new.releasing_team_approved or not new.receiving_team_approved then
      raise exception 'A transfer requires player consent and approval from both team managers before chairman approval';
    end if;
    if not public.cpl_is_chairman() then raise exception 'Only the chairman can finalize a transfer'; end if;
    select * into player_row from public.cpl_players where firebase_uid = new.player_uid and season = new.season for update;
    if not found or player_row.current_team_id is distinct from new.from_team_id then raise exception 'Player is no longer registered with the releasing team'; end if;
    if not coalesce((select transfers_open from public.cpl_seasons where season = new.season),false) then raise exception 'The transfer window is closed'; end if;
    update public.cpl_players set current_team_id = new.to_team_id, updated_at = now() where id = player_row.id;
    insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
    values (new.season,auth.jwt() ->> 'email','transfer_finalized','transfer',new.id::text,jsonb_build_object('player_uid',new.player_uid,'from_team_id',new.from_team_id,'to_team_id',new.to_team_id));
  end if;
  return new;
end; $$;
drop trigger if exists cpl_finalize_transfer_trigger on public.cpl_transfer_requests;
create trigger cpl_finalize_transfer_trigger before update of status on public.cpl_transfer_requests
for each row execute function public.cpl_finalize_approved_transfer();

-- Revision history is retained whenever an already-created report is edited.
create or replace function public.cpl_capture_report_revision()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if row(new.season,new.fixture_id,new.home_score,new.away_score,new.event_notes,new.status,new.chairman_note)
     is distinct from row(old.season,old.fixture_id,old.home_score,old.away_score,old.event_notes,old.status,old.chairman_note) then
    insert into public.cpl_match_report_revisions(report_id,old_record,new_record,changed_by_uid,changed_by_email)
    values (old.id,to_jsonb(old),to_jsonb(new),auth.jwt() ->> 'sub',auth.jwt() ->> 'email');
  end if;
  return new;
end; $$;
drop trigger if exists cpl_report_revision_trigger on public.cpl_match_reports;
create trigger cpl_report_revision_trigger before update on public.cpl_match_reports
for each row execute function public.cpl_capture_report_revision();

-- Approved League results become official atomically. Cup results do not enter league standings.
create or replace function public.cpl_apply_approved_match_report()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.cpl_fixtures%rowtype;
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from 'approved')) then
    select * into f from public.cpl_fixtures where id = new.fixture_id for update;
    if not found then raise exception 'Fixture does not exist'; end if;
    if exists (select 1 from public.cpl_match_reports r where r.fixture_id = new.fixture_id and r.status = 'approved' and r.id <> new.id) then
      raise exception 'This fixture already has an approved report. Use the existing report amendment workflow.';
    end if;
    update public.cpl_fixtures set home_score = new.home_score, away_score = new.away_score, status = 'approved', updated_at = now() where id = new.fixture_id;
    if coalesce(f.competition,'League') = 'League' then
      -- Calculate the canonical statistics from all approved league fixtures.
      with rules as (select points_win, points_draw, points_loss from public.cpl_seasons where season = new.season),
      match_rows as (
        select coalesce(fx.home_team_id, ht.id) home_id, coalesce(fx.away_team_id, away_team.id) away_id,
               fx.home_score hs, fx.away_score ascore
        from public.cpl_fixtures fx
        left join public.cpl_teams ht on ht.season = fx.season and lower(ht.name) = lower(fx.home_team)
        left join public.cpl_teams away_team on away_team.season = fx.season and lower(away_team.name) = lower(fx.away_team)
        where fx.season = new.season and fx.status = 'approved' and fx.competition = 'League'
          and fx.home_score is not null and fx.away_score is not null
      ), team_rows as (
        select home_id team_id, 1 played, case when hs > ascore then 1 else 0 end won,
          case when hs = ascore then 1 else 0 end drawn, case when hs < ascore then 1 else 0 end lost,
          hs gf, ascore ga, case when hs > ascore then (select points_win from rules) when hs = ascore then (select points_draw from rules) else (select points_loss from rules) end pts from match_rows
        union all
        select away_id, 1, case when ascore > hs then 1 else 0 end,
          case when ascore = hs then 1 else 0 end, case when ascore < hs then 1 else 0 end,
          ascore, hs, case when ascore > hs then (select points_win from rules) when ascore = hs then (select points_draw from rules) else (select points_loss from rules) end from match_rows
      ), totals as (
        select team_id, sum(played)::int played, sum(won)::int won, sum(drawn)::int drawn,
          sum(lost)::int lost, sum(gf)::int gf, sum(ga)::int ga, sum(pts)::int points
        from team_rows where team_id is not null group by team_id
      )
      update public.cpl_teams t set
        played = coalesce((select x.played from totals x where x.team_id = t.id),0),
        won = coalesce((select x.won from totals x where x.team_id = t.id),0),
        drawn = coalesce((select x.drawn from totals x where x.team_id = t.id),0),
        lost = coalesce((select x.lost from totals x where x.team_id = t.id),0),
        gf = coalesce((select x.gf from totals x where x.team_id = t.id),0),
        ga = coalesce((select x.ga from totals x where x.team_id = t.id),0),
        points = coalesce((select x.points from totals x where x.team_id = t.id),0), updated_at = now()
      where t.season = new.season;
      -- Reapply explicit chairman overrides; a manual correction is never silently lost.
      update public.cpl_teams t set played = o.override_value from public.cpl_standing_overrides o where o.team_id=t.id and o.season=t.season and o.field_name='played' and o.active;
      update public.cpl_teams t set won = o.override_value from public.cpl_standing_overrides o where o.team_id=t.id and o.season=t.season and o.field_name='won' and o.active;
      update public.cpl_teams t set drawn = o.override_value from public.cpl_standing_overrides o where o.team_id=t.id and o.season=t.season and o.field_name='drawn' and o.active;
      update public.cpl_teams t set lost = o.override_value from public.cpl_standing_overrides o where o.team_id=t.id and o.season=t.season and o.field_name='lost' and o.active;
      update public.cpl_teams t set gf = o.override_value from public.cpl_standing_overrides o where o.team_id=t.id and o.season=t.season and o.field_name='gf' and o.active;
      update public.cpl_teams t set ga = o.override_value from public.cpl_standing_overrides o where o.team_id=t.id and o.season=t.season and o.field_name='ga' and o.active;
      update public.cpl_teams t set points = o.override_value from public.cpl_standing_overrides o where o.team_id=t.id and o.season=t.season and o.field_name='points' and o.active;
    end if;
    insert into public.cpl_audit_log(season,actor_email,action,record_type,record_id,details)
    values (new.season,auth.jwt() ->> 'email','match_report_approved','match_report',new.id::text,jsonb_build_object('fixture_id',new.fixture_id,'home_score',new.home_score,'away_score',new.away_score));
  end if;
  return new;
end; $$;
drop trigger if exists cpl_apply_approved_report_trigger on public.cpl_match_reports;
create trigger cpl_apply_approved_report_trigger after insert or update of status on public.cpl_match_reports
for each row execute function public.cpl_apply_approved_match_report();

-- Replace email-only policy bodies with trusted JWT identity/role checks. The bootstrap remains temporary.
drop policy if exists "CPL bootstrap admin manages teams" on public.cpl_teams;
create policy "CPL chairman manages teams" on public.cpl_teams for all using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());
drop policy if exists "CPL bootstrap admin manages fixtures" on public.cpl_fixtures;
create policy "CPL chairman manages fixtures" on public.cpl_fixtures for all using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());
drop policy if exists "CPL admin manages squad requests" on public.cpl_squad_requests;
create policy "CPL chairman manages squad requests" on public.cpl_squad_requests for update using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());
drop policy if exists "CPL admin reviews transfers" on public.cpl_transfer_requests;
create policy "CPL chairman reviews transfers" on public.cpl_transfer_requests for update using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());
drop policy if exists "Users read own CPL transfer requests" on public.cpl_transfer_requests;
create policy "Users managers and admins read CPL transfer requests" on public.cpl_transfer_requests for select using (
  requested_by_uid = auth.jwt() ->> 'sub' or player_uid = auth.jwt() ->> 'sub' or public.cpl_is_admin()
  or exists (select 1 from public.cpl_team_managers m where m.team_id in (cpl_transfer_requests.from_team_id,cpl_transfer_requests.to_team_id) and m.season=cpl_transfer_requests.season and m.manager_uid=auth.jwt() ->> 'sub' and m.is_active)
  or exists (select 1 from public.cpl_teams t where t.id in (cpl_transfer_requests.from_team_id,cpl_transfer_requests.to_team_id) and t.season=cpl_transfer_requests.season and t.manager_uid=auth.jwt() ->> 'sub')
);

drop policy if exists "CPL admin reviews match reports" on public.cpl_match_reports;
create policy "CPL chairman reviews match reports" on public.cpl_match_reports for update using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());
drop policy if exists "Report submitters and admin read reports" on public.cpl_match_reports;
create policy "Report submitters and authorized admins read reports" on public.cpl_match_reports for select using (submitted_by_uid = auth.jwt() ->> 'sub' or public.cpl_is_admin());
drop policy if exists "CPL admin reads audit log" on public.cpl_audit_log;
create policy "CPL admin reads audit log" on public.cpl_audit_log for select using (public.cpl_is_admin());
drop policy if exists "CPL admin inserts audit log" on public.cpl_audit_log;
create policy "CPL admin inserts audit log" on public.cpl_audit_log for insert with check (public.cpl_is_admin());

alter table public.cpl_seasons enable row level security;
alter table public.cpl_system_settings enable row level security;
alter table public.cpl_user_roles enable row level security;
alter table public.cpl_ownership_transfers enable row level security;
alter table public.cpl_players enable row level security;
alter table public.cpl_team_managers enable row level security;
alter table public.cpl_referee_assignments enable row level security;
alter table public.cpl_match_report_events enable row level security;
alter table public.cpl_match_report_revisions enable row level security;
alter table public.cpl_payments enable row level security;
alter table public.cpl_match_cards enable row level security;
alter table public.cpl_team_finance_entries enable row level security;
alter table public.cpl_standing_overrides enable row level security;

-- Public settings expose competition rules only. Sensitive ownership and role tables are private.
drop policy if exists "CPL seasons public read" on public.cpl_seasons;
create policy "CPL seasons public read" on public.cpl_seasons for select using (true);
drop policy if exists "CPL admin manages seasons" on public.cpl_seasons;
create policy "CPL admin manages seasons" on public.cpl_seasons for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());
drop policy if exists "CPL admin manages system settings" on public.cpl_system_settings;
create policy "CPL admin manages system settings" on public.cpl_system_settings for all using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());
drop policy if exists "CPL admins read roles" on public.cpl_user_roles;
create policy "CPL admins read roles" on public.cpl_user_roles for select using (public.cpl_is_admin());
drop policy if exists "CPL admins manage roles" on public.cpl_user_roles;
create policy "CPL admins manage roles" on public.cpl_user_roles for all using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());
drop policy if exists "Owners read ownership transfer" on public.cpl_ownership_transfers;
create policy "Owners read ownership transfer" on public.cpl_ownership_transfers for select using (previous_owner_uid = auth.jwt() ->> 'sub' or proposed_owner_uid = auth.jwt() ->> 'sub' or public.cpl_is_chairman());
drop policy if exists "CPL admin manages players" on public.cpl_players;
create policy "CPL admin manages players" on public.cpl_players for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());
drop policy if exists "Players manage own profile" on public.cpl_players;
create policy "Players manage own profile" on public.cpl_players for select using (firebase_uid = auth.jwt() ->> 'sub');
drop policy if exists "Team managers read own assignments" on public.cpl_team_managers;
create policy "Team managers read own assignments" on public.cpl_team_managers for select using (manager_uid = auth.jwt() ->> 'sub' or public.cpl_is_admin());
drop policy if exists "CPL chairman manages team managers" on public.cpl_team_managers;
create policy "CPL chairman manages team managers" on public.cpl_team_managers for all using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());
drop policy if exists "Referees read own assignments" on public.cpl_referee_assignments;
create policy "Referees read own assignments" on public.cpl_referee_assignments for select using (referee_uid = auth.jwt() ->> 'sub' or public.cpl_is_admin());
drop policy if exists "CPL admin manages referee assignments" on public.cpl_referee_assignments;
create policy "CPL admin manages referee assignments" on public.cpl_referee_assignments for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());
drop policy if exists "CPL admin manages report events" on public.cpl_match_report_events;
create policy "CPL admin manages report events" on public.cpl_match_report_events for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());
drop policy if exists "CPL admins read report revisions" on public.cpl_match_report_revisions;
create policy "CPL admins read report revisions" on public.cpl_match_report_revisions for select using (public.cpl_is_admin());
drop policy if exists "Payers read own CPL payments" on public.cpl_payments;
create policy "Payers read own CPL payments" on public.cpl_payments for select using (payer_uid = auth.jwt() ->> 'sub' or public.cpl_is_admin());
drop policy if exists "Payers submit pending CPL payments" on public.cpl_payments;
create policy "Payers submit pending CPL payments" on public.cpl_payments for insert with check (payer_uid = auth.jwt() ->> 'sub' and status = 'pending_verification' and verified_by_uid is null);
drop policy if exists "CPL admins verify payments" on public.cpl_payments;
create policy "CPL admins verify payments" on public.cpl_payments for update using (public.cpl_is_admin()) with check (public.cpl_is_admin());
drop policy if exists "Public verifies active match cards" on public.cpl_match_cards;
create policy "Public verifies active match cards" on public.cpl_match_cards for select using (status = 'active');
drop policy if exists "CPL admin manages match cards" on public.cpl_match_cards;
create policy "CPL admin manages match cards" on public.cpl_match_cards for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());
drop policy if exists "Team finance visible to managers and admins" on public.cpl_team_finance_entries;
create policy "Team finance visible to managers and admins" on public.cpl_team_finance_entries for select using (public.cpl_is_admin() or exists (select 1 from public.cpl_team_managers m where m.team_id = cpl_team_finance_entries.team_id and m.season = cpl_team_finance_entries.season and m.manager_uid = auth.jwt() ->> 'sub' and m.is_active));
drop policy if exists "Team managers create finance entries" on public.cpl_team_finance_entries;
create policy "Team managers create finance entries" on public.cpl_team_finance_entries for insert with check (created_by_uid = auth.jwt() ->> 'sub' and exists (select 1 from public.cpl_team_managers m where m.team_id = cpl_team_finance_entries.team_id and m.season = cpl_team_finance_entries.season and m.manager_uid = auth.jwt() ->> 'sub' and m.is_active));
drop policy if exists "CPL admins manage standing overrides" on public.cpl_standing_overrides;
create policy "CPL chairman manages standing overrides" on public.cpl_standing_overrides for all using (public.cpl_is_chairman()) with check (public.cpl_is_chairman());

-- Keep private audit and financial fields out of ordinary public queries.
revoke all on public.cpl_user_roles, public.cpl_system_settings, public.cpl_ownership_transfers, public.cpl_match_report_revisions from anon;
grant select on public.cpl_seasons to anon, authenticated;
grant select on public.cpl_public_players to anon, authenticated;
grant select on public.cpl_public_match_card_verification to anon, authenticated;
revoke select on public.cpl_match_cards from anon, authenticated;
revoke select on public.cpl_squad_requests from anon, authenticated;
grant select (id, season, team_id, full_name, position, shirt_number, status, fee_amount, manager_reviewed_by, manager_reviewed_at, created_at) on public.cpl_squad_requests to authenticated;
grant select on public.cpl_ownership_transfers to authenticated;
grant select on public.cpl_user_roles to authenticated;
grant select, insert, update on public.cpl_players to authenticated;
grant select, insert, update, delete on public.cpl_team_managers to authenticated;
grant select, insert, update, delete on public.cpl_referee_assignments to authenticated;
grant select on public.cpl_match_report_revisions to authenticated;
grant select, insert, update on public.cpl_payments to authenticated;
grant select, insert, update on public.cpl_match_cards to authenticated;
grant select, insert on public.cpl_team_finance_entries to authenticated;
grant select, insert, update on public.cpl_match_report_events to authenticated;
grant select on public.cpl_standing_overrides to authenticated;
grant select, insert, update on public.cpl_seasons to authenticated;
-- The client may read public team fields, but not internal creator/updater emails.
revoke select on public.cpl_teams from anon, authenticated;
grant select (id, season, name, league, played, won, drawn, lost, gf, ga, points, notes, short_name, aliases, logo_url, home_ground, participation_status, manager_name, created_at, updated_at) on public.cpl_teams to anon, authenticated;
grant insert, update, delete on public.cpl_teams to authenticated;
grant insert, update, delete on public.cpl_fixtures to authenticated;
grant insert on public.cpl_squad_requests to authenticated;
revoke select on public.cpl_seasons from anon, authenticated;
grant select (season, name, current_leg, is_current, squad_joining_fee, player_registration_fee, match_card_fee, referee_fee_per_team_match, transfers_open, points_win, points_draw, points_loss, tiebreakers, updated_at) on public.cpl_seasons to anon, authenticated;
grant execute on function public.cpl_is_chairman() to anon, authenticated;
grant execute on function public.cpl_set_current_season(text) to authenticated;
grant execute on function public.cpl_create_season(text,text,text,boolean) to authenticated;
grant execute on function public.cpl_is_admin() to anon, authenticated;
grant execute on function public.cpl_has_role(text) to anon, authenticated;
grant execute on function public.cpl_request_ownership_transfer(text,text) to authenticated;
grant execute on function public.cpl_accept_ownership_transfer(uuid) to authenticated;
grant execute on function public.cpl_set_standing_override(uuid,text,integer,text) to authenticated;
grant execute on function public.cpl_review_squad_request(uuid,text) to authenticated;
grant execute on function public.cpl_assign_team_manager(uuid,text,text,text) to authenticated;
grant execute on function public.cpl_assign_referee(uuid,text,text) to authenticated;
grant execute on function public.cpl_submit_transfer(text,uuid,text) to authenticated;
grant execute on function public.cpl_player_approve_transfer(uuid) to authenticated;
grant execute on function public.cpl_approve_transfer_as_team_manager(uuid,text) to authenticated;

comment on table public.cpl_seasons is 'Configurable season rules. The current 2026 second leg is preserved.';
comment on table public.cpl_match_report_revisions is 'Immutable snapshots of report revisions for audit and chairman review.';
comment on table public.cpl_payments is 'CPL payments remain pending until verified by an authorized administrator.';
comment on table public.cpl_team_finance_entries is 'A ledger of recorded team contributions and expenses, not a wallet or held balance.';
comment on table public.cpl_standing_overrides is 'Explicit chairman corrections that survive recalculation from approved results.';
