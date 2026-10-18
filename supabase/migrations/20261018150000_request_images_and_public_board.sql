-- Request board image attachments and public image delivery.
alter table public.paid_request_payments
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-requests', 'community-requests', true, 2621440, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Uploads are performed by community-api using the service role; public reads
-- use the bucket's public URL. Do not grant direct anonymous uploads.
