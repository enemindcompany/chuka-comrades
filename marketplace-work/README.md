
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
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Project status

Foundation setup in progress. Features will be implemented incrementally.


## Account activation

The 48-hour trial and KSh 100 manual payment-reference review flow is documented in [ACTIVATION_SETUP.md](./ACTIVATION_SETUP.md). Before testing, apply the new Supabase migration and deploy the `activation-api` Edge Function with the required Firebase project ID and allowed frontend origins. The admin must verify the real M-PESA transaction before approving a submitted reference.


## Room marketplace updates (15 October 2026)

- Every listing represents one room and costs KSh 200.
- Landlords upload up to five JPG, PNG, or WebP room photos (2.5 MB each).
- New listings remain private until the administrator verifies the M-PESA transaction reference against actual payment records.
- Listing payments use M-PESA Till 6817863. Typing a reference only submits it for manual review; it does not activate the listing.
- Room availability can be set to Available, Booked, or Closed.
- Student enquiries open a direct WhatsApp chat to the number supplied by the landlord/caretaker.

Apply the new database migration and redeploy `hostel-api` before testing these changes. See `ROOM_MARKETPLACE_SETUP.md`.
