-- View-only hostel marketplace: no checkout, listing fee or in-app payment flow.
-- Legacy payment columns are retained for compatibility/history but are no longer used by the app.
alter table public.hostel_listings drop constraint if exists hostel_listings_listing_fee_check;
alter table public.hostel_listings alter column listing_fee_ksh set default 0;
update public.hostel_listings set listing_fee_ksh = 0;
-- Previously configured paid-listing expiry should not hide rooms in the view-only marketplace.
update public.hostel_listings set expires_at = null where expires_at is not null;
