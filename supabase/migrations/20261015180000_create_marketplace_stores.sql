-- Persistent seller profiles: one store per signed-in Firebase account.
create table if not exists public.marketplace_stores (
  created_by text primary key,
  seller_email text not null,
  seller_name text not null check (char_length(seller_name) between 2 and 80),
  store_name text not null check (char_length(store_name) between 2 and 100),
  business_type text not null check (char_length(business_type) between 2 and 60),
  location text not null check (char_length(location) between 2 and 150),
  whatsapp_number text not null check (char_length(whatsapp_number) between 9 and 20),
  description text not null check (char_length(description) between 5 and 1000),
  delivery_options text[] not null default array['Collection']::text[],
  updated_at timestamptz not null default now()
);
alter table public.marketplace_stores enable row level security;
revoke all on public.marketplace_stores from anon, authenticated;
grant all on public.marketplace_stores to service_role;
