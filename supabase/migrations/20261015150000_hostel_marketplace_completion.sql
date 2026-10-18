-- Complete hostel marketplace: landlords only, 30-day paid listings, moderation and audit trail.
-- Existing caretaker accounts/listings are retained but normalized to landlord ownership records.
update public.hostel_managers set role = 'landlord' where role = 'caretaker';
update public.hostel_listings set manager_role = 'landlord' where manager_role = 'caretaker';

alter table public.hostel_managers drop constraint if exists hostel_managers_role_check;
alter table public.hostel_managers add constraint hostel_managers_role_check check (role = 'landlord');
alter table public.hostel_listings drop constraint if exists hostel_listings_manager_role_check;
alter table public.hostel_listings add constraint hostel_listings_manager_role_check check (manager_role = 'landlord');

alter table public.hostel_listings
  add column if not exists expires_at timestamptz,
  add column if not exists admin_suspended boolean not null default false,
  add column if not exists admin_suspension_reason text;

-- Existing paid rooms get a 30-day grace period from migration; newly approved rooms expire 30 days after verification.
update public.hostel_listings
set expires_at = coalesce(payment_verified_at, now()) + interval '30 days'
where payment_status = 'paid' and expires_at is null;
create index if not exists hostel_listings_expiry_idx on public.hostel_listings (expires_at);
create index if not exists hostel_listings_moderation_idx on public.hostel_listings (admin_suspended, listing_status);

create table if not exists public.hostel_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  listing_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.hostel_admin_audit enable row level security;
revoke all on public.hostel_admin_audit from anon, authenticated;
grant all on public.hostel_admin_audit to service_role;
