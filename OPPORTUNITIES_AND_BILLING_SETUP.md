# Chuka Comrades: Opportunities and subscriptions

## Fees and access
- Opportunities access: **KSh 100 one time** for permanent access to full descriptions, links and contacts. Members submit an M-Pesa transaction reference; an administrator manually verifies it. Sharing an opportunity is separate from buying access.
- Marketplace store subscription: **KSh 300 per 30 days**. Store profiles remain free to create/manage, but publishing new marketplace products/services requires an active store subscription. Browsing and contacting sellers remain free. Existing listings can still be edited/hidden if a subscription expires.
- The app does not collect online checkout payments or automatically verify M-Pesa. Never mark a payment approved until it has been checked against the official M-Pesa statement.

## Opportunity categories
Referral links, WhatsApp groups, online jobs, scholarships and bursaries, attachments and internships, skill learning, and other opportunities. Signed-in, verified accounts can browse teasers and share opportunity listings. The backend hides full descriptions, application links and contacts until the one-time access payment is approved. Links must be valid HTTP/HTTPS URLs.

## Configure M-Pesa payment details
Add the confirmed official destination to `.env.local` (leave these blank until the business Till/Paybill is confirmed):

```dotenv
VITE_MPESA_TILL=
VITE_MPESA_PAYBILL=
VITE_MPESA_ACCOUNT=
```

Restart Vite after changing `.env.local`. Do not put secret API keys in `VITE_` variables. Payment destinations are public display details only.

## Deploy from the project folder

```powershell
npm ci
npx supabase link --project-ref lpngtuxcgpjxwvikdpxl
npx supabase db push
npx supabase functions deploy activation-api --no-verify-jwt
npx supabase functions deploy marketplace-api --no-verify-jwt
npx supabase functions deploy opportunity-api --no-verify-jwt
npm run build
npm run dev
```

Set the required Supabase function secrets if not already configured: `FIREBASE_PROJECT_ID`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Ensure `FRONTEND_ORIGINS` contains the exact production website origin. The functions validate Firebase ID tokens themselves, hence `--no-verify-jwt`.

## Admin workflow
Sign in as the configured administrator (`sidneywafula30@gmail.com`) and open **Admin → Payment verification**. Review pending KSh 100 Opportunities access and KSh 300 store subscription requests. Approving Opportunities access grants permanent full-detail access; approving a store payment grants 30 days. Reject incorrect/unverifiable references.

## Before going live
- Confirm the correct M-Pesa Till/Paybill and account name.
- Make a test payment and verify the reference in M-Pesa records before approving it.
- Run `npm run build` and test Opportunities access approval, opportunity sharing, subscription renewal and listing creation on the deployed site.

## Revised access rules (October 2026)

- Opportunities: KSh 100 is a one-time payment for permanent full-detail access. The list shows title/category teasers until an administrator verifies the M-Pesa reference. Sharing opportunities is separate from buying access.
- Hookup: KSh 50 grants seven days after admin approval. Anonymous posts and anonymous messaging are removed. Hookup is a separate navigation page, not part of Hostels & Roommates.
- eFootball: KSh 20 is a one-time player-listing fee. Players submit their in-game name, a squad image (JPG/PNG/WEBP, max 5 MB), a short bio, and the M-Pesa reference. After admin approval the player is listed and can view the player directory and tournaments and create tournaments.
- Marketplace: the existing KSh 300 / 30-day store subscription remains unchanged.

All three new/revised payment types use manual M-Pesa reference review. Do not approve a payment unless you have checked the actual transaction.

## Deploy revised features

From the project root in PowerShell:

```powershell
npm ci
npx supabase link --project-ref lpngtuxcgpjxwvikdpxl
npx supabase db push
npx supabase functions deploy opportunity-api --no-verify-jwt
npx supabase functions deploy activation-api --no-verify-jwt
npx supabase functions deploy community-api --no-verify-jwt
npx supabase functions deploy marketplace-api --no-verify-jwt
npm run build
npm run dev
```

Ensure the existing Supabase function secrets include `FIREBASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `FRONTEND_ORIGINS`. Set the official `VITE_MPESA_TILL` or `VITE_MPESA_PAYBILL` values in `.env.local` before publishing; these details are not guessed or filled in by the project.


## Latest community profile and eFootball updates

The migration `20261015210000_hookup_profiles_and_community_fields.sql` adds Hookup profiles and preferences, roommate gender, and eFootball WhatsApp/tournament-number fields. Apply it and redeploy both changed Edge Functions:

```powershell
npx supabase db push
npx supabase functions deploy community-api --no-verify-jwt
npx supabase functions deploy hostel-api --no-verify-jwt
npm run build
```

Hookup profile access is available only while the user's KSh 50 weekly subscription is active. Payment references still require manual admin verification. eFootball listings require a WhatsApp number and KSh 20 one-time fee approval.
