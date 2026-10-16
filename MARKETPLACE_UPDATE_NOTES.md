# Marketplace update notes

This update changes the accommodation marketplace to a browse-and-contact directory:

- Removed the room listing fee and M-PESA reference submission from the marketplace UI.
- Removed the marketplace payment-review panel and its Edge Function route.
- New listings publish immediately after the landlord account has been approved.
- Viewers can use the listing's WhatsApp button to open a direct, prefilled chat with the landlord.
- Added a visible warning that Chuka Comrades does not collect or guarantee payments made outside the app.
- Limited new manager registrations to landlords; the existing database migration normalizes legacy caretaker records.
- Added a migration that drops the old fixed listing-fee constraint and clears previous paid-listing expiry dates.

The legacy payment columns remain in Supabase for compatibility and historical data, but the current marketplace code no longer exposes payment actions. This is not a payment integration.
