-- Chuka Comrades activation: 48-hour trial and admin-reviewed KSh 100 payments.
-- All reads/writes are performed by the activation-api Edge Function using service role.
create table if not exists public.activation_accounts (
  firebase_uid text primary key,
  email text not null,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '48 hours'),
  status text not null default 'trial'
    check (status in ('trial', 'pending', 'active', 'rejected')),
  payment_reference text,
  payment_submitted_at timestamptz,
  activated_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activation_active_requires_date
    check (status <> 'active' or activated_at is not null)
);

create index if not exists activation_accounts_status_submitted_idx
  on public.activation_accounts (status, payment_submitted_at);

alter table public.activation_accounts enable row level security;
revoke all on public.activation_accounts from anon, authenticated;
