# Chuka Comrades activation setup

This project includes a 48-hour first-login trial, KSh 100 M-PESA Till payment-reference submission, admin payment review for `sidneywafula30@gmail.com`, and a hostel marketplace with landlord/caretaker access requests, listing creation, and owner-only editing/deletion.

## Important behavior

- A trial is created once per Firebase UID when the activation API is first called after sign-in. Re-signing in does not restart it. Payment submission is rejected by the server until the recorded 48-hour trial has ended.
- Students are asked to send KSh 100 to Till `6817863`, then submit the M-PESA transaction reference.
- A submitted reference stays pending until the authorized admin approves or rejects it.
- Approval sets the account to active. The app checks activation status after sign-in.
- The current payment flow is **manual M-PESA verification**, not an automatic STK Push. The admin must compare the transaction reference against the actual M-PESA transaction before approving. Never approve a typed reference alone.
- A submitted reference is normalized to uppercase and duplicate pending/active transaction references are rejected.
- The admin must sign in with the specified Google account and Firebase must mark that email as verified.
- Hostel listings are visible to signed-in users. A landlord/caretaker must request manager access; the administrator approves that request before the account can publish. An approved manager can edit/delete only listings created by their own Firebase UID.

## 1. Restore your local environment

The project ZIP deliberately omits `.env.local` and Supabase's generated `.temp` files because they may contain private configuration. Keep your existing `.env.local` file safe. If you need to recreate it, copy `.env.example` to `.env.local` and populate it with the same web-client values from your own Firebase and Supabase settings.

Do not put the Supabase service-role key or Firebase service-account private key in any `VITE_*` variable. Browser-exposed variables must never contain server secrets.

## 2. Apply the database migration

From the project root, ensure the Supabase CLI is linked to the correct project, then run:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
npx supabase db push
```

Review the migration before applying it to a production database.

## 3. Configure Edge Function secrets

Set the Firebase project ID and your production frontend origins. Replace the sample origin with the exact origin(s) where the app is hosted. Include localhost while testing locally.

```powershell
npx supabase secrets set FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID FRONTEND_ORIGINS="http://localhost:5173,https://YOUR-PRODUCTION-DOMAIN"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are normally supplied to Supabase Edge Functions by the platform. If your deployment does not supply them, configure them in the Supabase function secrets panel. Never add the service-role key to `.env.local` with a `VITE_` prefix.

**Important for the current “Could not reach the activation service” message:** local `http://localhost:5173` is explicitly allowed by both Edge Functions in this project. For production, `window.location.origin` must match an entry in `FRONTEND_ORIGINS` by protocol, hostname, and port. For example, `https://chuka-comrades.example` differs from `http://chuka-comrades.example` and `https://www.chuka-comrades.example`. Do not include a page path. Trailing slashes and surrounding spaces in configured entries are normalized. After updating the secret, redeploy both functions. In Supabase Dashboard, open **Edge Functions → activation-api → Logs** to inspect failed requests. After changing `.env.local`, stop and restart Vite. If localhost still fails after deployment, verify the Supabase project URL/key and inspect the browser Network tab for the OPTIONS request and the function logs.

The Roommate Finder was added to **Hostels & Roommates**. It supports students who already have a hostel and students who have not found one yet. It stores profiles in Supabase, so before testing it, apply the new `20261015110000_create_roommate_profiles.sql` migration with `npx supabase db push`, then redeploy `hostel-api`. Profile phone numbers are visible to signed-in students; only share a number you are comfortable publishing to the campus community.

## 4. Deploy the activation API

```powershell
npx supabase functions deploy activation-api --no-verify-jwt
npx supabase functions deploy hostel-api --no-verify-jwt
```

The function validates Firebase ID tokens itself. The `--no-verify-jwt` option is required because the incoming bearer token is a Firebase token, not a Supabase Auth token. Do not disable this custom Firebase verification.

## 5. Run and test

```powershell
npm install
npm run dev
```

Test with a regular student account:
1. Sign in and confirm the activation service creates a trial.
2. While the trial is active, the app features remain available.
3. To test the expired-trial screen safely, use a separate test database/account or adjust the trial timestamp in a non-production test database.
4. Submit a payment reference and confirm the admin sees it as pending.
5. Sign in as `sidneywafula30@gmail.com`, open **Admin payments**, compare the transaction with the actual M-PESA record, and approve or reject it.
6. Confirm approval removes the activation gate by clicking **Check payment status** (or refreshing/signing in again).
7. In **Hostels & Roommates**, register a test account as a landlord/caretaker. In **Admin payments**, approve its manager request. Confirm it can create and edit its own listing but cannot edit another account's listing.

## Payment automation note

The Till payment-reference workflow works after the database migration, Edge Function deployment, and secrets setup. It does **not** initiate an STK Push or receive automatic M-PESA callbacks. To automate payment confirmation, configure Safaricom Daraja credentials for the correct Buy Goods/Till product and deploy a public, validated callback handler; those business credentials and callback details are not included in this project. Do not claim a payment is automatic until a real end-to-end test confirms the callback and reconciliation flow.

## Production security note

The activation table has RLS enabled and denies direct access to `anon` and `authenticated`; the Edge Function uses the service role only after validating the Firebase token and, for review actions, the verified admin email. This frontend gate is not by itself an entitlement check for every future backend feature. Any future Edge Function or database-backed feature that must be paid-only must also verify activation on the server before returning or mutating protected data. Do not treat a typed M-PESA reference alone as proof of payment.
