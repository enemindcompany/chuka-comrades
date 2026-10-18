-- Weekly Hookup access and one-time paid eFootball player listings.
create table if not exists public.hookup_subscriptions (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  email text not null,
  payment_reference text not null unique check (char_length(payment_reference) between 4 and 80),
  status text not null default 'pending' check (status in ('pending','active','rejected','expired')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hookup_subscriptions_uid_idx on public.hookup_subscriptions(firebase_uid, expires_at desc);
create index if not exists hookup_subscriptions_status_idx on public.hookup_subscriptions(status, submitted_at desc);
alter table public.hookup_subscriptions enable row level security;
revoke all on public.hookup_subscriptions from anon, authenticated;
grant all on public.hookup_subscriptions to service_role;

create table if not exists public.efootball_players (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text not null,
  player_name text not null check (char_length(player_name) between 2 and 60),
  squad_image_url text not null,
  bio text not null default '' check (char_length(bio) <= 400),
  payment_reference text not null unique check (char_length(payment_reference) between 4 and 80),
  payment_status text not null default 'pending' check (payment_status in ('pending','active','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists efootball_players_active_idx on public.efootball_players(payment_status, created_at desc);
alter table public.efootball_players enable row level security;
revoke all on public.efootball_players from anon, authenticated;
grant all on public.efootball_players to service_role;

create table if not exists public.efootball_tournaments (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  organizer_name text not null check (char_length(organizer_name) between 2 and 100),
  title text not null check (char_length(title) between 3 and 120),
  details text not null check (char_length(details) between 5 and 1000),
  event_date date,
  contact text not null check (char_length(contact) between 3 and 150),
  created_at timestamptz not null default now()
);
create index if not exists efootball_tournaments_date_idx on public.efootball_tournaments(event_date, created_at desc);
alter table public.efootball_tournaments enable row level security;
revoke all on public.efootball_tournaments from anon, authenticated;
grant all on public.efootball_tournaments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('efootball-squads', 'efootball-squads', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "Public can view eFootball squad images" on storage.objects for select using (bucket_id = 'efootball-squads');
