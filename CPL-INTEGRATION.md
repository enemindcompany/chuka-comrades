# Chuka Premier League integration

CPL remains inside the existing Chuka Comrades PWA and uses its Firebase sign-in with Supabase's Firebase JWT integration. This update extends the existing `cpl_` schema; it does not reset the 2026 season or seed invented fixtures, scores, teams, or standings.

## Added in this update

- Server/RLS-backed chairman checks through `cpl_is_chairman()` and `cpl_is_admin()` instead of trusting a typed email in the UI.
- Secure two-party ownership transfer request/accept functions. The proposed owner must sign in as the selected Firebase UID and accept; accepting disables the temporary email bootstrap.
- Configurable 2026 season settings, second-leg status, match-card fee (KSh 100), current-season free squad joining, referee fee (KSh 200 per team per match), points, and tiebreakers.
- Team profile fields for short name, aliases, logo, home ground, participation status, and manager identity.
- Player, team-manager, referee-assignment, match event, payment, match-card, finance-ledger, standing-override, and report-revision tables.
- Assigned-referee-only match report submission, pending manual M-Pesa verification records, and safe public player directory view that excludes private contact and payment data.
- Chairman-approved League reports update the official fixture and recalculate standings. Explicit chairman corrections are recorded with a reason and survive recalculation. League A/B positions use points, goal difference, goals scored, then head-to-head points.
- Squad request approval is handled by a database function that checks the selected team manager or chairman, prevents duplicate active requests, creates the registered player record, and applies no current-season squad fee. Team managers and referees can be assigned through chairman tools.
- The CPL UI now asks the database to confirm admin/chairman permissions, supports reasoned standing corrections, exposes a public team/player directory, lets the chairman configure/create/select seasons and official fixtures, assign team managers/referees, and provides the two-party ownership transfer interface. Transfers require player consent, releasing and receiving team-manager approvals, and chairman final approval before the roster changes.

## Apply migrations

From the project folder, run:

```powershell
npx supabase link --project-ref lpngtuxcgpjxwvikdpxl
npx supabase db push
```

The new migration is `supabase/migrations/20261015230000_cpl_workflows_hardening.sql`. It depends on the existing `20261015220000_cpl_current_season.sql` migration. Do not delete or rewrite applied migrations.

## Authentication requirement

The existing Supabase client passes the signed-in Firebase ID token through the Supabase `accessToken` callback. The Supabase project must be configured to trust Firebase as a third-party JWT provider. If it is not configured, CPL RLS will reject writes; do not disable RLS as a workaround.

## Source data limitation

The provided upload contained the development prompt and the current project ZIP, but no official WhatsApp export or verified standings/fixture files. Therefore, this update deliberately does not import or invent teams, match results, player statistics, payment history, or transfer records. The transfer window is initialized closed for safety; the chairman must explicitly open it in Season Rules only if official CPL policy allows. Import the verified second-leg records only after the chairman reviews the source and resolves conflicting names/fixtures.

## Test and completion status

The modified TSX passed a TypeScript transpilation syntax check. A full production build could not be completed in this workspace because dependency installation timed out and the installed `node_modules` lacked `vite/client` and Node type definitions. Run `npm ci` in the project folder and then `npm run build`; apply the migration to a staging Supabase project and exercise the workflows before production. The following remain follow-up work before declaring the full brief production-complete:

- Complete secretary role/permission management, team renewal/retirement, and secure manager replacement history.
- Expand referee reports into structured goals, assists, cards, substitutions, appearances, injuries, and evidence forms; the current form captures score and notes.
- Import and preserve the September 2026 memorandum identifying 12 invalid transfers once that source record is supplied.
- Finish finance reporting screens, match-card issue/expiry operations, awards/Cup-statistics imports, dedicated shareable team/player detail routes, and comprehensive automated tests.
- Import verified CPL second-leg records and check official tiebreaker rules with the chairman.
- Perform live database migration/RLS testing in the configured Supabase project before production use.


## WhatsApp source data import (15 Oct 2026)

See [`CPL-WHATSAPP-IMPORT.md`](./CPL-WHATSAPP-IMPORT.md) and `data/cpl-whatsapp-import/` for the source-derived team list, 182 official first-leg fixtures, 19 result candidates pending verification, CPL Cup scorer/assist sheets, transfer memo history, mid-season transfer submissions, award criteria, and fee/disciplinary evidence. Apply migration `20261016000000_cpl_whatsapp_official_data_import.sql` only after backing up the database and reviewing the source caveats. No results, standings, payments, active roster transfers, or winners are inferred from unverified group messages.
