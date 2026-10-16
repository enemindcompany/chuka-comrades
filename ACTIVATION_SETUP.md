# Legacy account activation flow

The current Chuka Comrades frontend no longer uses the old 48-hour trial or KSh 100 account activation payment flow. General app access is free. This document is retained only because older Supabase migrations and the `activation-api` Edge Function may still exist in the project; they are not required for the current frontend.

Do not ask users to send an activation fee or submit an M-PESA reference to use the app or marketplace. The marketplace is for browsing and direct WhatsApp contact only; it does not accept payments.

If the legacy activation service is no longer needed, it can be removed separately after confirming no other deployed client uses it. Do not drop its database tables without checking historical records first.
