# CPL WhatsApp source import — 2026

## What was extracted

This package was built from the user-supplied WhatsApp group export. It imports only identifiable CPL source records; unrelated chat, ads, personal messages, and the unrelated university graduation list were not imported.

### Included in the Supabase migration

`supabase/migrations/20261016000000_cpl_whatsapp_official_data_import.sql` is designed to run after the existing CPL migrations. It adds source-reference tables and inserts:

- **28 team records** from the official first-leg fixture PDFs (14 in League A and 14 in League B).
- **182 first-leg fixtures** (91 per league), dated 10 September–15 October 2026. All are inserted as `scheduled`, with no score and no venue inferred.
- **20 CPL Cup player-stat rows** combined from the Cup scorers and assists PDFs. They remain `pending_confirmation`; the group post explicitly asked for confirmation. The Pochon scorer listed as `N/A` remains unidentified.
- **12 invalidated transfers** from official memorandum `MEM/027/09/26`, dated 27 September 2026. These are stored as historical rulings and do not change rosters.
- **33 mid-season transfer submissions** listed on 13 October (23 team-to-team and 10 free-agent submissions). These are `submitted_for_review_not_approved`; no roster is changed.
- **19 reported result candidates** from explicit results posts on 14 Sep, 21 Sep, 27 Sep and 13 Oct. These are stored separately as `pending_chairman_verification` and do not update fixture scores or standings.
- **20 official award definitions/criteria** from `AWARDS.pdf`; no winners are inferred.
- Source-captured rules, fee mentions, disciplinary sanctions and historical arrears. These are evidence records only, not live payment receipts or automatic charges.

The migration is designed to be re-runnable: it uses conflict-safe inserts, does not delete existing rows, does not overwrite existing teams, and avoids inserting a duplicate fixture for the same home/away teams on the same local date in the first leg.

## Important source qualifications

1. **Fixture times and venues can change.** The official PDFs contain scheduled kickoff windows, but the WhatsApp group later states that fixture pairings should remain while time and venue can change due to pitch availability. Imported fixtures therefore have no venue and the original scheduled times are retained only as source data.
2. **No results or standings were fabricated.** The export contains scattered score posts, informal updates, and references to updated tables, but no single complete verified final standings document. The migration stores 19 explicitly posted scores as separate review candidates; it does not mark fixtures approved or update standings from those messages. Import only results the chairman/referee team verifies.
3. **Registration fee conflict:** January minutes say KSh 5,000 due by 30 January 2026. A 9 September message lists KSh 6,000 for selected teams. Neither amount is automatically applied to current team balances; chairman/treasurer should reconcile the policy and receipts.
4. **Transfer safety:** the 27 September memo declares 12 transfers after the 20 September deadline null and void and says players remain at their original clubs. The 13 October list is stored as submissions only. Verify player consent, team signatures, identity, window status and league approval before changing a roster.
5. **Cup statistics:** the scorer/assist sheets list one goal or assist per listed entry, but the chat asks for confirmation. They are not merged into registered player records or official leaderboards.
6. **Disciplinary fines/arrears:** a 25 September notice issues KSh 500 fines to Culsa FC and Ateker FC. The export does not contain receipts, so payment is unverified. January minutes mention historical arrears for Supersport and Milan/Millan; these are not treated as current balances.
7. **Authority:** names appearing in WhatsApp are reference information only. The migration does not assign the chairman role or transfer ownership to a person based on a display name or group username.

## CSV source extracts

The `data/cpl-whatsapp-import/` folder contains CSV review copies:

- `teams-2026.csv`
- `first-leg-fixtures-2026.csv`
- `cpl-cup-player-stats-2026.csv`
- `transfer-history-review-2026.csv`
- `result-candidates-review-2026.csv`
- `award-definitions-2026.csv`
- `rules-and-fee-evidence-2026.csv`
- `disciplinary-and-arrears-evidence-2026.csv`

These CSVs are useful for audit/review and do not themselves change the database.

## Apply safely

1. Back up the Supabase database first.
2. Confirm the earlier CPL migrations are already applied.
3. Run `npx supabase link --project-ref lpngtuxcgpjxwvikdpxl` if this working copy is not already linked.
4. Review the migration SQL, then run `npx supabase db push`.
5. In Supabase, verify row counts in the new tables and spot-check several fixture dates/team names.
6. Have the chairman/referee team review fixtures, match results, cup statistics, transfer submissions, fees and disciplinary balances before treating them as final.

This is a source-data import, not a claim that the entire CPL workflow UI is complete or that a live database migration has been tested in this environment.
