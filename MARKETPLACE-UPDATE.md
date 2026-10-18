# Chuka Comrades Marketplace update

## Included
- Persistent seller store profile per signed-in Firebase account: seller name, store name, business type, working location, WhatsApp, store description, and delivery/collection options.
- Sellers can reopen and update their store profile any time while signed in.
- Saving store details updates those details on the seller's existing marketplace listings.
- Product listings still support up to five JPG/PNG/WebP images, category, description, KSh price or contact-for-price, negotiable pricing, and available/sold/hidden states.
- Product cards use a WhatsApp-first order/enquiry link with product, displayed price, and a prompt to confirm stock and delivery/collection.
- No online checkout or payment processing is added.
- Listing validation errors are more descriptive and form constraints now match backend limits more closely.

## Apply on Windows PowerShell
Run from `C:\opvanta\chuka-comrades` after extracting this ZIP over your project. Keep your existing `.env.local` file; it is intentionally not included in the ZIP.

```powershell
npm ci
npx supabase db push
npx supabase functions deploy marketplace-api --no-verify-jwt
npm run build
npm run dev
```

Ensure the Supabase Edge Function secrets already include `FIREBASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `FRONTEND_ORIGINS` for your deployed site origin. The migration `20261015180000_create_marketplace_stores.sql` creates the persistent store profile table.

## Order flow
The app opens WhatsApp with a prefilled message; the buyer and seller confirm stock, quantity, delivery/collection, and payment directly. Chuka Comrades does not record or guarantee an order and does not collect payment in this version.
