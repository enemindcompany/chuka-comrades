-- An M-PESA transaction code should not activate two accounts at once.
create unique index if not exists activation_payment_reference_unique_active_idx
  on public.activation_accounts (lower(trim(payment_reference)))
  where payment_reference is not null and status in ('pending', 'active');
