# Secure Firebase profile API

This Edge Function accepts a Firebase ID token, verifies its signature and standard claims against the configured Firebase project, and allows the verified user to read or update only the student profile whose `firebase_uid` matches the token's `sub` claim.

## Required server-side configuration

Set these secrets for the Supabase project before deploying:

- `FIREBASE_PROJECT_ID`: `chuka-comrades`
- `SUPABASE_SERVICE_ROLE_KEY`: the project's service-role key, stored only in Supabase Edge Function secrets. Never put it in `.env.local`, React code, GitHub, or any public client bundle.

Supabase provides `SUPABASE_URL` to deployed Edge Functions. If it is not present in the deployment environment, set it as a function secret too.

## Deploy

From the repository root, after reviewing this code and confirming the Supabase CLI is linked to the intended project:

```powershell
npx supabase login
npx supabase link --project-ref lpngtuxcgpjxwvikdpxl
npx supabase secrets set FIREBASE_PROJECT_ID=chuka-comrades SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
npx supabase functions deploy firebase-profile-api --no-verify-jwt
```

Replace `YOUR_SERVICE_ROLE_KEY` locally with the key from Supabase Dashboard → Project Settings → API. Do not share it in chat or commit it. Prefer setting secrets individually if your shell or CLI has trouble with special characters.

## Request contract

Send `Authorization: Bearer <Firebase ID token>` and the Supabase publishable/anon key in `apikey`. Supported routes are GET (load the caller's profile) and POST (upsert allowed profile fields). The function never accepts a client-supplied Firebase UID. It uses the verified token's subject instead.

The database table must already exist. Keep RLS enabled and do not create public/anon policies. This function uses a server-side service-role key, so the code must remain narrowly scoped and reviewed before deployment.
