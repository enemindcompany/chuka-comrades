-- eFootball account listings and optional tournament posters.
alter table public.efootball_players
  add column if not exists account_for_sale boolean not null default false,
  add column if not exists account_price_ksh integer;
alter table public.efootball_players
  add constraint efootball_account_price_positive
  check (account_price_ksh is null or account_price_ksh > 0);

alter table public.efootball_tournaments
  add column if not exists image_url text;

-- Reuse the existing public eFootball image bucket for posters.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'efootball-squads';
