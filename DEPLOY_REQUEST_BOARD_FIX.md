# Chuka Comrades request board deployment

This update removes the home-page quick-link panel, adds dedicated **My Hostel** and **Find Roommate** pages, displays approved community requests on the home dashboard, and supports optional JPG/PNG/WebP request images (up to 2.5 MB).

## Apply on the linked Supabase project (PowerShell)

Run these from the project root. Review the migration list before pushing because the project previously contained two CPL migrations with the same timestamp; one has been given a unique local version so the CLI can order them.

```powershell
npx supabase migration list
npx supabase db push
npx supabase functions deploy community-api --no-verify-jwt
```

If `migration list` shows that the remote project has already recorded `20261016010000` for the *other* CPL migration, stop before `db push` and inspect the local/remote migration history; do not reset the database or delete migration records to force it through.

## Verify

1. Sign in and open **Requests · KSh 10**.
2. Submit a test request with a JPG/PNG/WebP image under 2.5 MB and a valid payment reference. It remains private until an administrator approves payment.
3. Approve the payment in the admin area. The request should appear on the home dashboard and the public activated-request board with its image.
4. Confirm **Hostels & rooms**, **My Hostel (Landlords)**, and **Find Roommate** are separate navigation pages.

The edge function validates Firebase ID tokens itself; keep deployment flag `--no-verify-jwt` and retain `FRONTEND_ORIGINS` with `https://enemindcompany.github.io` (no path) plus localhost for development.
