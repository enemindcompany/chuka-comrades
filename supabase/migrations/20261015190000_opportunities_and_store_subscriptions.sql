-- Opportunity board and monthly marketplace store subscriptions.
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  author_name text not null check (char_length(author_name) between 2 and 100),
  title text not null check (char_length(title) between 3 and 140),
  category text not null check (category in ('Referral links','WhatsApp groups','Online jobs','Scholarships & bursaries','Attachments & internships','Skill learning','Other')),
  description text not null check (char_length(description) between 10 and 3000),
  link_url text not null check (char_length(link_url) between 8 and 1500),
  deadline date,
  contact text check (contact is null or char_length(contact) <= 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists opportunities_created_at_idx on public.opportunities (created_at desc);
create index if not exists opportunities_category_idx on public.opportunities (category, created_at desc);
alter table public.opportunities enable row level security;
revoke all on public.opportunities from anon, authenticated;
grant all on public.opportunities to service_role;

create table if not exists public.marketplace_store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  seller_email text not null,
  amount_ksh integer not null default 300 check (amount_ksh = 300),
  payment_reference text not null unique check (char_length(payment_reference) between 4 and 80),
  status text not null default 'pending' check (status in ('pending','active','rejected','expired')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_subscription_active_dates check (status <> 'active' or (starts_at is not null and expires_at is not null))
);
create index if not exists store_subscriptions_user_idx on public.marketplace_store_subscriptions (created_by, expires_at desc);
create index if not exists store_subscriptions_status_idx on public.marketplace_store_subscriptions (status, submitted_at desc);
alter table public.marketplace_store_subscriptions enable row level security;
revoke all on public.marketplace_store_subscriptions from anon, authenticated;
grant all on public.marketplace_store_subscriptions to service_role;
