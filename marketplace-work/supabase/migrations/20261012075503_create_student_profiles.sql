
-- Chuka Comrades: student profiles foundation
-- This migration is safe to prepare locally.
-- Do not apply to production until Firebase identity claims are verified.

create table if not exists public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  display_name text,
  university text not null default 'Chuka University',
  campus text,
  course text,
  year_of_study integer
    check (year_of_study between 1 and 10),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

-- No client policies yet.
-- Access remains denied until we add policies based on
-- a verified Firebase identity and test them.
revoke all on public.student_profiles from anon, authenticated;
