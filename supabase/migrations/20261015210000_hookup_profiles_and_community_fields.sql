-- Hookup profiles/preferences, roommate gender, and eFootball WhatsApp/tournament numbers.

create table if not exists public.hookup_profiles (
  firebase_uid text primary key,
  display_name text not null check (char_length(display_name) between 2 and 80),
  age integer not null check (age between 18 and 99),
  gender text not null check (gender in ('Woman','Man','Non-binary','Prefer not to say')),
  looking_for text not null check (looking_for in ('Women','Men','Everyone')),
  preferred_age_min integer not null default 18 check (preferred_age_min between 18 and 99),
  preferred_age_max integer not null default 99 check (preferred_age_max between 18 and 99),
  preferred_area text not null check (char_length(preferred_area) between 2 and 100),
  interests text not null default '' check (char_length(interests) <= 300),
  about text not null default '' check (char_length(about) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hookup_profiles_age_range_check check (preferred_age_min <= preferred_age_max)
);
create index if not exists hookup_profiles_discovery_idx on public.hookup_profiles(gender, age, updated_at desc);
alter table public.hookup_profiles enable row level security;
revoke all on public.hookup_profiles from anon, authenticated;
grant all on public.hookup_profiles to service_role;

alter table public.roommate_profiles add column if not exists gender text not null default 'Prefer not to say';
alter table public.roommate_profiles drop constraint if exists roommate_profiles_gender_check;
alter table public.roommate_profiles add constraint roommate_profiles_gender_check check (gender in ('Woman','Man','Non-binary','Prefer not to say'));
-- Course and year are no longer collected in the roommate finder UI.
alter table public.roommate_profiles drop constraint if exists roommate_profiles_course_check;
alter table public.roommate_profiles drop constraint if exists roommate_profiles_year_of_study_check;
alter table public.roommate_profiles alter column course set default '';
alter table public.roommate_profiles alter column year_of_study set default '';

alter table public.efootball_players add column if not exists whatsapp_number text not null default '';
alter table public.efootball_players drop constraint if exists efootball_players_whatsapp_number_check;
alter table public.efootball_players add constraint efootball_players_whatsapp_number_check check (char_length(whatsapp_number) <= 20);
alter table public.efootball_tournaments add column if not exists tournament_number text not null default '';
alter table public.efootball_tournaments drop constraint if exists efootball_tournaments_tournament_number_check;
alter table public.efootball_tournaments add constraint efootball_tournaments_tournament_number_check check (char_length(tournament_number) <= 80);
