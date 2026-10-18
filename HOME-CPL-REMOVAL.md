# Home page CPL section removal

This update removes the Chuka Premier League card from the Chuka Trends home-page grid and hides its navigation entry for now. The CPL module source, account-type flow, migrations, and CPL data files are retained so they can be reintroduced later.

No database changes or migrations are required for this UI-only change. Keep your existing `.env.local` and Firebase configuration when applying the update.

Build verification was not run in this packaging environment because dependencies are not installed here. After copying the files into your working project, run `npm run build`.
