-- Per-room listing fee, multiple room photos, availability and manual payment review.
alter table public.hostel_listings
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists listing_status text not null default 'available',
  add column if not exists listing_fee_ksh integer not null default 200,
  add column if not exists payment_status text not null default 'paid',
  add column if not exists payment_reference text,
  add column if not exists payment_submitted_at timestamptz,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by text;

update public.hostel_listings
set image_urls = case when image_url is not null and image_url <> '' then array[image_url] else '{}'::text[] end
where cardinality(image_urls) = 0;
update public.hostel_listings
set listing_status = case when is_available then 'available' else 'booked' end
;

alter table public.hostel_listings alter column payment_status set default 'unpaid';
alter table public.hostel_listings drop constraint if exists hostel_listings_listing_status_check;
alter table public.hostel_listings add constraint hostel_listings_listing_status_check
  check (listing_status in ('available','booked','closed'));
alter table public.hostel_listings drop constraint if exists hostel_listings_payment_status_check;
alter table public.hostel_listings add constraint hostel_listings_payment_status_check
  check (payment_status in ('unpaid','pending_review','paid','rejected'));
alter table public.hostel_listings drop constraint if exists hostel_listings_listing_fee_check;
alter table public.hostel_listings add constraint hostel_listings_listing_fee_check check (listing_fee_ksh = 200);
create unique index if not exists hostel_listings_payment_reference_unique
  on public.hostel_listings (upper(payment_reference)) where payment_reference is not null;
create index if not exists hostel_listings_payment_review_idx
  on public.hostel_listings (payment_status, payment_submitted_at);

-- Public room images. Uploads are performed by the authenticated Edge Function using service_role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-images', 'room-images', true, 2621440, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2621440,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- New room records are always unpaid; existing listings remain paid during migration.
