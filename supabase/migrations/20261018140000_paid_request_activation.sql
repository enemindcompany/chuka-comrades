-- KSh 10 request activation and KSh 100 roommate finder submission payments.
create table if not exists public.paid_request_payments (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  email text not null,
  request_type text not null check (request_type in ('general','roommate_finder')),
  amount_ksh integer not null check (amount_ksh in (10,100)),
  request_title text,
  request_details text,
  payment_reference text not null unique check (char_length(payment_reference) between 4 and 80),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  used_at timestamptz,
  check ((request_type = 'general' and amount_ksh = 10) or (request_type = 'roommate_finder' and amount_ksh = 100)),
  check (request_type <> 'general' or (char_length(coalesce(request_title,'')) between 3 and 120 and char_length(coalesce(request_details,'')) between 5 and 1200))
);
create index if not exists paid_request_payments_uid_idx on public.paid_request_payments(firebase_uid, created_at desc);
create index if not exists paid_request_payments_pending_idx on public.paid_request_payments(status, created_at) where status = 'pending';
alter table public.paid_request_payments enable row level security;
revoke all on public.paid_request_payments from anon, authenticated;
grant all on public.paid_request_payments to service_role;
