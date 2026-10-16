# Chuka Comrades

A student-focused Progressive Web App (PWA) for Chuka University.

## Technology
- React
- TypeScript
- Vite
- Supabase
- Firebase Authentication
- Progressive Web App support

## Development

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Campus marketplace

The marketplace supports real listings for items, stores and services. Sellers can add up to five photos, set a price or mark it contact-for-price, and publish their WhatsApp number so viewers can start a direct conversation. Sellers can edit, mark listings sold, hide or delete their own listings.

The marketplace is view-and-contact only. It has no checkout, no in-app payments and no listing fee. Buyers should inspect an item/service and verify the seller before sending money directly outside the app.

## Hostel marketplace

Landlords can publish accommodation details and photos, add a WhatsApp number, and manage availability. Landlord registration requires administrator approval. Caretaker registration and hostel listing payments are disabled. See [ROOM_MARKETPLACE_SETUP.md](./ROOM_MARKETPLACE_SETUP.md).

## Database and Edge Functions

Apply migrations and deploy the Edge Functions from the project root:

```powershell
npx supabase db push
npx supabase functions deploy hostel-api --no-verify-jwt
npx supabase functions deploy marketplace-api --no-verify-jwt
npx supabase functions deploy opportunity-api --no-verify-jwt
npx supabase functions deploy activation-api --no-verify-jwt
npx supabase functions deploy community-api --no-verify-jwt
```

Keep Firebase service credentials and the Supabase service-role key only in server-side Edge Function secrets. Never put them in `VITE_*` variables.

## Legacy activation service

General app access is free. The KSh 100 payment unlocks permanent full-detail access to Opportunities; M-Pesa references require manual admin verification. See [ACTIVATION_SETUP.md](./ACTIVATION_SETUP.md) for compatibility notes.


## Opportunities and paid store listings
See [OPPORTUNITIES_AND_BILLING_SETUP.md](./OPPORTUNITIES_AND_BILLING_SETUP.md) for KSh 100 permanent Opportunities access, KSh 50 weekly Hookup access, KSh 20 one-time eFootball listing, KSh 300/month store subscription, manual M-Pesa verification, and the latest Hookup/roommate/eFootball migration.


## CPL 2026 WhatsApp data import

See [CPL-WHATSAPP-IMPORT.md](./CPL-WHATSAPP-IMPORT.md) for the imported official first-leg schedule, pending result candidates, transfer history, Cup stats, award criteria, and the safe Supabase migration steps. The migration preserves existing records and leaves unverified results/transfers pending review.
