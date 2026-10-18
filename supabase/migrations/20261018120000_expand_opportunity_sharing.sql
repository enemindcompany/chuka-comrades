begin;

alter table public.opportunities
  alter column link_url set default '';

alter table public.opportunities
  alter column link_url drop not null;

alter table public.opportunities
  drop constraint if exists opportunities_category_check;

alter table public.opportunities
  add constraint opportunities_category_check
  check (
    category in (
      'Referral links',
      'WhatsApp groups',
      'Online jobs',
      'Scholarships & bursaries',
      'Attachments & internships',
      'Skill learning',
      'Contacts & referrals',
      'Events & competitions',
      'Business opportunities',
      'Other'
    )
  );

alter table public.opportunities
  drop constraint if exists opportunities_link_url_check;

alter table public.opportunities
  add constraint opportunities_link_url_check
  check (
    link_url = '' or char_length(link_url) between 8 and 1500
  );

alter table public.opportunities
  drop constraint if exists opportunities_link_or_contact_check;

alter table public.opportunities
  add constraint opportunities_link_or_contact_check
  check (
    char_length(btrim(link_url)) > 0
    or (
      contact is not null
      and char_length(btrim(contact)) > 0
    )
  );

commit;
