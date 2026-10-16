-- Campus marketplace is a browse-and-contact directory, not a checkout/payment system.
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  seller_email text not null,
  store_name text not null check (char_length(store_name) between 2 and 100),
  title text not null check (char_length(title) between 2 and 120),
  category text not null check (category in ('Books','Electronics','Fashion','Home','Food','Services','Other')),
  price_ksh integer not null default 0 check (price_ksh >= 0),
  price_negotiable boolean not null default false,
  location text not null check (char_length(location) between 2 and 150),
  whatsapp_number text not null check (char_length(whatsapp_number) between 9 and 20),
  description text not null check (char_length(description) between 5 and 2000),
  image_urls text[] not null default '{}',
  status text not null default 'available' check (status in ('available','sold','closed')),
  admin_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_listings_created_by_idx on public.marketplace_listings (created_by);
create index if not exists marketplace_listings_browse_idx on public.marketplace_listings (status, category, created_at desc);

alter table public.marketplace_listings enable row level security;
revoke all on public.marketplace_listings from anon, authenticated;
grant all on public.marketplace_listings to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-images', 'marketplace-images', true, 2621440, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2621440,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
