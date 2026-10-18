-- Hostel marketplace. Access is mediated by the hostel-api Edge Function.
create table if not exists public.hostel_managers (
  firebase_uid text primary key,
  email text not null,
  role text not null check (role in ('landlord', 'caretaker')),
  phone text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hostel_listings (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  manager_email text not null,
  manager_role text not null check (manager_role in ('landlord', 'caretaker')),
  name text not null check (char_length(name) between 2 and 100),
  area text not null check (char_length(area) between 2 and 100),
  address text not null check (char_length(address) between 2 and 250),
  rent_ksh integer not null check (rent_ksh > 0),
  deposit_ksh integer not null default 0 check (deposit_ksh >= 0),
  room_type text not null check (char_length(room_type) between 2 and 80),
  vacancies integer not null default 1 check (vacancies between 0 and 500),
  phone text not null check (char_length(phone) between 9 and 20),
  description text not null check (char_length(description) between 5 and 2000),
  amenities text[] not null default '{}',
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hostel_listings_created_by_idx on public.hostel_listings (created_by);
create index if not exists hostel_listings_browse_idx on public.hostel_listings (is_available, area, created_at desc);

alter table public.hostel_managers enable row level security;
alter table public.hostel_listings enable row level security;
revoke all on public.hostel_managers from anon, authenticated;
revoke all on public.hostel_listings from anon, authenticated;
grant all on public.hostel_managers to service_role;
grant all on public.hostel_listings to service_role;
