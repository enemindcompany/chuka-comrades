-- Student roommate finder. Profiles are accessed only through the verified hostel-api Edge Function.
create table if not exists public.roommate_profiles (
  firebase_uid text primary key,
  display_name text not null check (char_length(display_name) between 2 and 80),
  course text not null check (char_length(course) between 2 and 100),
  year_of_study text not null check (char_length(year_of_study) between 1 and 30),
  housing_status text not null check (housing_status in ('have_hostel', 'looking')),
  preferred_area text not null check (char_length(preferred_area) between 2 and 100),
  monthly_budget_ksh integer not null check (monthly_budget_ksh between 0 and 100000),
  hostel_name text,
  bio text not null default '' check (char_length(bio) <= 500),
  contact_phone text not null check (char_length(contact_phone) between 9 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists roommate_profiles_browse_idx on public.roommate_profiles (housing_status, preferred_area, monthly_budget_ksh);
alter table public.roommate_profiles enable row level security;
revoke all on public.roommate_profiles from anon, authenticated;
grant all on public.roommate_profiles to service_role;
