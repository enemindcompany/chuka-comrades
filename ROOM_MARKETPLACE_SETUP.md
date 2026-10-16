# Chuka Comrades Room Marketplace Setup

## Marketplace behaviour

- The marketplace is for viewing accommodation listings, photos, rent, amenities and availability.
- Chuka Comrades does not provide checkout, accept online payments, or collect listing fees.
- Each listing has a WhatsApp number entered by the landlord and a direct WhatsApp conversation link for viewers.
- Viewers should arrange an in-person viewing and independently verify the landlord/property before sending money.
- Landlords can create, edit and delete their own listings and change availability to Available, Booked or Closed. Closed listings are hidden from public browsing but remain visible to their owner.
- Landlord access is still subject to administrator approval. Caretaker registration is disabled.

## Apply database changes

Run from the project root after extracting this project and configuring the Supabase CLI link:

```powershell
npx supabase db push
npx supabase functions deploy hostel-api --no-verify-jwt
```

The `20261015160000_view_only_hostel_marketplace.sql` migration removes the legacy listing-fee constraint and clears old expiry dates so previously listed rooms are not hidden by the former paid-listing model. Legacy payment columns remain in the database for compatibility, but the current frontend and Edge Function no longer expose payment submission or payment review actions.

## WhatsApp contact

Landlords enter a WhatsApp number when registering and can update the number on each room listing. The listing card opens WhatsApp with a prefilled enquiry. The app opens the chat; it does not send messages automatically.

## Security notes

- Keep Firebase service credentials and the Supabase service-role key only in server-side Edge Function secrets. Never put them in `VITE_*` variables.
- Only verified Firebase sessions can create or edit listings. The Edge Function checks landlord approval server-side.
- Review photos and listing details for accuracy. Do not advertise a room you are not authorised to offer.

## General campus marketplace

The separate campus marketplace supports item/service listings with a store name, category, price (or contact-for-price), location, up to five photos and a seller WhatsApp number. Buyers browse listings and contact sellers directly. It has no checkout, online payment, or listing fee. Sellers can edit, delete, mark sold, or hide their own listings.

Apply `20261015170000_create_marketplace_listings.sql` and deploy the `marketplace-api` Edge Function. The function uses Firebase token verification and Supabase service-role access server-side; clients cannot write directly to the marketplace table.
