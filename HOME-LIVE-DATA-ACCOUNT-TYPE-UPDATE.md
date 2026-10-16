# Home page and CPL first-login account preferences

## Changes
- Storefront-inspired home page layout with a larger welcome panel, spacious live-data cards and responsive styling.
- CPL account type is saved in `public.cpl_account_preferences` when a signed-in user first enters the league.
- User-selectable preferences: Fan, Player, Team Manager, Referee.
- Chairman and Secretary are intentionally not self-selectable; they must be assigned by the authorized CPL administrator account (`sidneywafula30@gmail.com`) using the existing role-management workflow.
- The preference table is separate from authorization roles, so a selected preference does not grant database permissions.
- Existing Google sign-in from Chuka Comrades is reused; users do not need a second Google identity session just to enter CPL.

## Required deployment step
Apply `supabase/migrations/20261016020000_cpl_first_login_account_preferences.sql` to the same Supabase project configured in `.env.local` before testing the first-time preference flow. Preserve `.env.local` and do not commit secrets.

## Validation
Run `npm ci` and `npm run build` locally. This source package has not been built in this environment because dependencies are not installed here. The Supabase migration has not been run against the live project.
