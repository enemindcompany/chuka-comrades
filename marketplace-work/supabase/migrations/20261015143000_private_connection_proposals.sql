-- Consent-based connection proposals. Contact and extended profile details are only returned by hostel-api after acceptance.
create table if not exists public.roommate_connection_proposals (
  id uuid primary key default gen_random_uuid(),
  requester_uid text not null references public.roommate_profiles(firebase_uid) on delete cascade,
  target_uid text not null references public.roommate_profiles(firebase_uid) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roommate_proposal_not_self check (requester_uid <> target_uid)
);
create index if not exists roommate_proposals_target_status_idx on public.roommate_connection_proposals (target_uid, status, created_at desc);
create index if not exists roommate_proposals_requester_idx on public.roommate_connection_proposals (requester_uid, created_at desc);
create unique index if not exists roommate_one_pending_directional_proposal_idx on public.roommate_connection_proposals (requester_uid, target_uid) where status = 'pending';
alter table public.roommate_connection_proposals enable row level security;
revoke all on public.roommate_connection_proposals from anon, authenticated;
grant all on public.roommate_connection_proposals to service_role;
