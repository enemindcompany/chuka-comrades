# Chuka Comrades room marketplace setup

This update keeps the existing Firebase sign-in and 48-hour application trial flow unchanged. Room listing payments are separate from app activation.

## 1. Apply the Supabase migration

From the project root, with the `chuka-comrades` project linked:

```powershell
npx supabase db push
```

This adds multiple image URLs, per-room KSh 200 payment status, manual verification fields, the unique M-PESA reference index, and the public `room-images` Storage bucket. Existing listings are retained as paid during migration; new listings start unpaid.

## 2. Deploy the updated Edge Function

```powershell
npx supabase functions deploy hostel-api --no-verify-jwt
npx supabase functions list
```

The function verifies Firebase ID tokens itself, so keep the existing `--no-verify-jwt` deployment setting used by this project. Confirm the function has the expected secrets configured, especially `FIREBASE_PROJECT_ID=chuka-comrades`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `FRONTEND_ORIGINS`. Never put the service-role key in a `VITE_*` variable.

## 3. Install/build the frontend

```powershell
npm install
npm run build
npm run dev
```

Restart Vite after environment changes. The app should continue to use the current `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## 4. How the room fee works

1. An approved landlord/caretaker creates one room listing and uploads up to five images.
2. The room is stored as `payment_status=unpaid` and is not visible to other users.
3. The landlord pays KSh 200 to M-PESA Till `6817863` and submits the transaction reference.
4. The listing becomes `pending_review`. A typed reference is **not** considered payment.
5. The verified administrator (`sidneywafula30@gmail.com`) checks the actual M-PESA transaction and approves or rejects it in the admin dashboard.
6. Only after approval does the room become publicly visible, unless its availability is set to Closed.

The same M-PESA reference cannot be reused for another room. A rejected submission can be replaced with a corrected transaction reference.

## 5. WhatsApp

Each room uses the landlord/caretaker WhatsApp number entered for the listing. Student enquiries open `wa.me` with a prefilled question. The app does not send messages automatically and does not require the WhatsApp Business API for direct chats.

## 6. Test checklist

- Upload 1–5 photos; reject unsupported file types and files over 2.5 MB.
- Create a room; confirm it is visible to its owner but not other accounts before payment approval.
- Submit a payment reference; confirm status becomes pending review, not paid.
- As the verified admin, verify a real payment and confirm the listing appears publicly.
- Reject a reference and confirm the landlord can submit a corrected one.
- Change availability among Available, Booked, and Closed. Closed listings should not appear in public browse results.
- Click Chat on WhatsApp and confirm the intended landlord number and room-specific prefilled message.
- Confirm the existing 48-hour app trial behavior is unchanged.


## Room editing and private campus connections update

- Owners can edit paid room listings and change status to **Available**, **Booked**, or **Closed**. Closed rooms are hidden from public browsing but remain visible in **My rooms** for future edits.
- The roommate/campus connection feature uses explicit proposals. Phone numbers and extended profile details are not returned to other users until the recipient accepts. Sending and accepting proposals both require a safety confirmation.
- Apply the new `20261015143000_private_connection_proposals.sql` migration and redeploy `hostel-api` after updating the frontend.
- Proposal acceptance only authorizes sharing the listed contact/profile details; it is not consent to a meeting, date, or sexual activity. Encourage public meetings, trusted-person check-ins, and never sharing PINs/passwords or sending money to strangers.
