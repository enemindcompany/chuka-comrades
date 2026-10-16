-- CPL 2026 WhatsApp-source import.
-- Adds sourced reference data without deleting or overwriting existing teams, fixtures, scores or standings.
-- Source: WhatsApp export attached by the user, especially the official final-draft first-leg PDFs,
-- official invalid-transfer memorandum, and CPL Cup scorer/assist sheets.
begin;

create table if not exists public.cpl_import_sources (
  id bigint generated always as identity primary key,
  source_key text not null unique,
  source_title text not null,
  source_date date,
  trust_level text not null check (trust_level in ('official_document','official_group_post','group_message')),
  notes text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cpl_imported_player_stats (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  competition text not null,
  player_name text not null,
  team_name text not null,
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  verification_status text not null default 'pending_confirmation'
    check (verification_status in ('pending_confirmation','confirmed','rejected')),
  source_document text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (season, competition, player_name, team_name)
);

create table if not exists public.cpl_transfer_history (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  record_type text not null check (record_type in ('invalid_after_deadline','midseason_transfer_submission','midseason_free_transfer_submission')),
  player_name text not null,
  from_team text not null,
  to_team text not null,
  source_date date,
  deadline date,
  status text not null,
  source_document text not null,
  note text not null,
  created_at timestamptz not null default now(),
  unique (season, record_type, player_name, from_team, to_team)
);

alter table public.cpl_import_sources enable row level security;
alter table public.cpl_imported_player_stats enable row level security;
alter table public.cpl_transfer_history enable row level security;

drop policy if exists "CPL import sources public read" on public.cpl_import_sources;
create policy "CPL import sources public read" on public.cpl_import_sources for select using (true);
drop policy if exists "CPL imported player stats public read" on public.cpl_imported_player_stats;
create policy "CPL imported player stats public read" on public.cpl_imported_player_stats for select using (true);
drop policy if exists "CPL transfer history public read" on public.cpl_transfer_history;
create policy "CPL transfer history public read" on public.cpl_transfer_history for select using (true);

drop policy if exists "CPL admins manage import sources" on public.cpl_import_sources;
create policy "CPL admins manage import sources" on public.cpl_import_sources for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());
drop policy if exists "CPL admins manage imported stats" on public.cpl_imported_player_stats;
create policy "CPL admins manage imported stats" on public.cpl_imported_player_stats for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());
drop policy if exists "CPL admins manage transfer history" on public.cpl_transfer_history;
create policy "CPL admins manage transfer history" on public.cpl_transfer_history for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());

insert into public.cpl_import_sources (source_key, source_title, source_date, trust_level, notes) values
('wa_2026_league_a_first_leg','Official Final Draft First Leg – League A Fixtures.pdf','2026-09-09','official_document','91 first-leg fixtures from 10 Sep to 15 Oct 2026. Schedule times are from the PDF; later WhatsApp messages explicitly say time and venue may change. No result or venue is inferred.'),
('wa_2026_league_b_first_leg','Updated Final Draft First Leg – League B Fixtures.pdf','2026-09-09','official_document','91 first-leg fixtures from 10 Sep to 15 Oct 2026. Schedule times are from the PDF; later WhatsApp messages explicitly say time and venue may change. No result or venue is inferred.'),
('wa_2026_invalid_transfer_memo','Official Memorandum MEM/027/09/26','2026-09-27','official_document','12 transfers concluded after the 20 Sep 2026 deadline declared null and void; players remain registered to original clubs.'),
('wa_2026_midseason_transfer_list','WhatsApp post: Mid-Season Transfers','2026-10-13','official_group_post','List is stored for review only. Consent, identity, signatures, registration and league approval have not been verified; roster is not changed.'),
('wa_2026_cup_scorers','CPL_CUP_SCORERS_SHEET.pdf','2026-09-18','official_document','Published sheet lists one goal each for 12 entries, including an unidentified Pochon scorer listed as N/A. Post asked for confirmation, so records are pending confirmation.'),
('wa_2026_cup_assists','CPL_CUP_ASSISTS_SHEET.pdf','2026-09-18','official_document','Published sheet lists one assist each for eight entries. Post asked for confirmation, so records are pending confirmation.'),
('wa_2026_jan_minutes','CPL officials meeting minutes posted 22 Jan 2026','2026-01-21','official_group_post','Minutes state team registration fee 5,000 KSh by 30 Jan 2026, maximum roster 25, and certain historical arrears. A later September post lists 6,000 KSh registration for selected teams; fee values are not auto-applied due to this discrepancy.'),
('wa_2026_awards','AWARDS.pdf – official award categories and criteria','2026-08-28','official_document','20 official award categories and criteria imported. No award winners are inferred.'),
('wa_2026_disciplinary_notice','Official disciplinary notice CPL/DIS/012/26','2026-09-25','official_document','KSh 500 fine each for Culsa FC and Ateker FC. Export contains no payment receipts; balances are not marked paid.'),
('wa_2026_result_posts','Selected CPL result posts dated 14 Sep, 21 Sep, 27 Sep and 13 Oct 2026','2026-10-13','official_group_post','19 result candidates extracted from explicit results posts. They remain pending chairman verification and do not affect fixtures or standings until approved.') 
on conflict (source_key) do nothing;


-- Official team names from the two first-leg fixture PDFs. Existing rows are preserved.
insert into public.cpl_teams (season, name, league, aliases, notes) values
('2026','Ateker','A',ARRAY['Aterker']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Chuka Boys','A',ARRAY['Chuka boys']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Chuka Santos','A',ARRAY['Santos']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Chuka Sports Club','A',ARRAY['Chuka Sports']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Culsa','A',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Maa','A',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Millan','A',ARRAY['Milan','Milan FC']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Quest','A',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Snipers','A',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Supersport','A',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','United','A',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Veterans','A',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Vicious','A',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Vulpes Nigra','A',ARRAY['Vulpes']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Ashland','B',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Avengers','B',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','City Stars','B',ARRAY['Citystars']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Cuksa','B',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Cunsa','B',ARRAY['Cunsa FC']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Meru Boys','B',ARRAY['Meru Boyz']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Phelites','B',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Pochon','B',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Pocusa','B',ARRAY['Pokuca']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Rerina','B',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Talanta','B',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Thunder Elites','B',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Vipers','B',ARRAY[]::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.'),
('2026','Young Stars','B',ARRAY['Youngstars']::text[],'Imported from official first-leg fixtures PDF; stats remain at defaults because no complete verified standings were supplied. Verify team registration and standings.')
on conflict (season, name) do nothing;

-- 182 official first-leg fixtures. Dates/times are imported as scheduled, not as proof a match occurred.
with schedule(season, league, match_week, match_date, kickoff, scheduled_end, home_team, away_team) as (
  values
('2026','A',1,'2026-09-10'::date,'12:00'::time,'13:30'::time,'Vulpes Nigra','Quest'),
('2026','A',1,'2026-09-10'::date,'14:00'::time,'15:30'::time,'Supersport','Millan'),
('2026','A',1,'2026-09-10'::date,'16:00'::time,'17:30'::time,'United','Ateker'),
('2026','A',1,'2026-09-11'::date,'10:00'::time,'11:30'::time,'Maa','Chuka Santos'),
('2026','A',1,'2026-09-11'::date,'12:00'::time,'13:30'::time,'Quest','Ateker'),
('2026','A',1,'2026-09-11'::date,'14:00'::time,'15:30'::time,'Culsa','Chuka Boys'),
('2026','A',1,'2026-09-11'::date,'16:00'::time,'17:30'::time,'Snipers','Veterans'),
('2026','A',1,'2026-09-12'::date,'08:00'::time,'09:30'::time,'Vicious','Chuka Sports Club'),
('2026','A',1,'2026-09-12'::date,'10:00'::time,'11:30'::time,'Vulpes Nigra','Millan'),
('2026','A',1,'2026-09-12'::date,'12:00'::time,'13:30'::time,'United','Chuka Sports Club'),
('2026','A',1,'2026-09-12'::date,'14:00'::time,'15:30'::time,'Snipers','Chuka Boys'),
('2026','A',1,'2026-09-12'::date,'16:00'::time,'17:30'::time,'Supersport','Veterans'),
('2026','A',1,'2026-09-13'::date,'08:00'::time,'09:30'::time,'Vulpes Nigra','Ateker'),
('2026','A',1,'2026-09-13'::date,'10:00'::time,'11:30'::time,'Culsa','Maa'),
('2026','A',1,'2026-09-13'::date,'12:00'::time,'13:30'::time,'Vicious','Chuka Santos'),
('2026','A',1,'2026-09-13'::date,'14:00'::time,'15:30'::time,'Quest','Chuka Sports Club'),
('2026','A',1,'2026-09-13'::date,'16:00'::time,'17:30'::time,'Millan','Veterans'),
('2026','A',2,'2026-09-17'::date,'12:00'::time,'13:30'::time,'Snipers','Maa'),
('2026','A',2,'2026-09-17'::date,'14:00'::time,'15:30'::time,'United','Chuka Santos'),
('2026','A',2,'2026-09-17'::date,'16:00'::time,'17:30'::time,'Supersport','Chuka Boys'),
('2026','A',2,'2026-09-18'::date,'10:00'::time,'11:30'::time,'Supersport','Maa'),
('2026','A',2,'2026-09-18'::date,'12:00'::time,'13:30'::time,'Ateker','Chuka Sports Club'),
('2026','A',2,'2026-09-18'::date,'14:00'::time,'15:30'::time,'Millan','Chuka Boys'),
('2026','A',2,'2026-09-18'::date,'16:00'::time,'17:30'::time,'Vulpes Nigra','Veterans'),
('2026','A',2,'2026-09-19'::date,'08:00'::time,'09:30'::time,'Quest','Chuka Santos'),
('2026','A',2,'2026-09-19'::date,'10:00'::time,'11:30'::time,'Vicious','Culsa'),
('2026','A',2,'2026-09-19'::date,'12:00'::time,'13:30'::time,'Vulpes Nigra','Chuka Sports Club'),
('2026','A',2,'2026-09-19'::date,'14:00'::time,'15:30'::time,'Snipers','Vicious'),
('2026','A',2,'2026-09-19'::date,'16:00'::time,'17:30'::time,'United','Culsa'),
('2026','A',2,'2026-09-20'::date,'08:00'::time,'09:30'::time,'Supersport','Vicious'),
('2026','A',2,'2026-09-20'::date,'10:00'::time,'11:30'::time,'Ateker','Chuka Santos'),
('2026','A',2,'2026-09-20'::date,'12:00'::time,'13:30'::time,'Millan','Maa'),
('2026','A',2,'2026-09-20'::date,'14:00'::time,'15:30'::time,'Quest','Culsa'),
('2026','A',2,'2026-09-20'::date,'16:00'::time,'17:30'::time,'Veterans','Chuka Boys'),
('2026','A',3,'2026-09-24'::date,'12:00'::time,'13:30'::time,'United','Snipers'),
('2026','A',3,'2026-09-24'::date,'14:00'::time,'15:30'::time,'Chuka Sports Club','Chuka Santos'),
('2026','A',3,'2026-09-24'::date,'16:00'::time,'17:30'::time,'Vulpes Nigra','Chuka Boys'),
('2026','A',3,'2026-09-25'::date,'10:00'::time,'11:30'::time,'Quest','Snipers'),
('2026','A',3,'2026-09-25'::date,'12:00'::time,'13:30'::time,'Ateker','Culsa'),
('2026','A',3,'2026-09-25'::date,'14:00'::time,'15:30'::time,'Chuka Boys','Maa'),
('2026','A',3,'2026-09-25'::date,'16:00'::time,'17:30'::time,'Chuka Santos','Culsa'),
('2026','A',3,'2026-09-26'::date,'08:00'::time,'09:30'::time,'Supersport','United'),
('2026','A',3,'2026-09-26'::date,'10:00'::time,'11:30'::time,'Millan','Vicious'),
('2026','A',3,'2026-09-26'::date,'12:00'::time,'13:30'::time,'Chuka Sports Club','Culsa'),
('2026','A',3,'2026-09-26'::date,'14:00'::time,'15:30'::time,'Vulpes Nigra','Chuka Santos'),
('2026','A',3,'2026-09-26'::date,'16:00'::time,'17:30'::time,'Veterans','Vicious'),
('2026','A',3,'2026-09-27'::date,'08:00'::time,'09:30'::time,'Vulpes Nigra','Maa'),
('2026','A',3,'2026-09-27'::date,'10:00'::time,'11:30'::time,'Millan','United'),
('2026','A',3,'2026-09-27'::date,'12:00'::time,'13:30'::time,'Quest','Supersport'),
('2026','A',3,'2026-09-27'::date,'14:00'::time,'15:30'::time,'Ateker','Snipers'),
('2026','A',3,'2026-09-27'::date,'16:00'::time,'17:30'::time,'Veterans','Maa'),
('2026','A',4,'2026-10-01'::date,'12:00'::time,'13:30'::time,'Chuka Sports Club','Snipers'),
('2026','A',4,'2026-10-01'::date,'14:00'::time,'15:30'::time,'Ateker','Millan'),
('2026','A',4,'2026-10-01'::date,'16:00'::time,'17:30'::time,'Veterans','United'),
('2026','A',4,'2026-10-02'::date,'10:00'::time,'11:30'::time,'Ateker','Supersport'),
('2026','A',4,'2026-10-02'::date,'12:00'::time,'13:30'::time,'Millan','Quest'),
('2026','A',4,'2026-10-02'::date,'14:00'::time,'15:30'::time,'Vulpes Nigra','Culsa'),
('2026','A',4,'2026-10-02'::date,'16:00'::time,'17:30'::time,'Chuka Boys','United'),
('2026','A',4,'2026-10-03'::date,'08:00'::time,'09:30'::time,'Chuka Sports Club','Supersport'),
('2026','A',4,'2026-10-03'::date,'10:00'::time,'11:30'::time,'Chuka Santos','Snipers'),
('2026','A',4,'2026-10-03'::date,'12:00'::time,'13:30'::time,'Chuka Boys','Vicious'),
('2026','A',4,'2026-10-03'::date,'14:00'::time,'15:30'::time,'Veterans','Quest'),
('2026','A',4,'2026-10-03'::date,'16:00'::time,'17:30'::time,'Maa','Vicious'),
('2026','A',4,'2026-10-04'::date,'08:00'::time,'09:30'::time,'Vulpes Nigra','Vicious'),
('2026','A',4,'2026-10-04'::date,'10:00'::time,'11:30'::time,'Maa','United'),
('2026','A',4,'2026-10-04'::date,'12:00'::time,'13:30'::time,'Culsa','Snipers'),
('2026','A',4,'2026-10-04'::date,'14:00'::time,'15:30'::time,'Chuka Santos','Supersport'),
('2026','A',4,'2026-10-04'::date,'16:00'::time,'17:30'::time,'Chuka Boys','Quest'),
('2026','A',5,'2026-10-08'::date,'12:00'::time,'13:30'::time,'Chuka Sports Club','Millan'),
('2026','A',5,'2026-10-08'::date,'14:00'::time,'15:30'::time,'Vulpes Nigra','Snipers'),
('2026','A',5,'2026-10-08'::date,'16:00'::time,'17:30'::time,'Veterans','Ateker'),
('2026','A',5,'2026-10-09'::date,'10:00'::time,'11:30'::time,'Maa','Quest'),
('2026','A',5,'2026-10-09'::date,'12:00'::time,'13:30'::time,'Culsa','Supersport'),
('2026','A',5,'2026-10-09'::date,'14:00'::time,'15:30'::time,'Chuka Boys','Ateker'),
('2026','A',5,'2026-10-09'::date,'16:00'::time,'17:30'::time,'Culsa','Millan'),
('2026','A',5,'2026-10-10'::date,'08:00'::time,'09:30'::time,'Vicious','Quest'),
('2026','A',5,'2026-10-10'::date,'10:00'::time,'11:30'::time,'Vulpes Nigra','United'),
('2026','A',5,'2026-10-10'::date,'12:00'::time,'13:30'::time,'Snipers','Supersport'),
('2026','A',5,'2026-10-10'::date,'14:00'::time,'15:30'::time,'Chuka Santos','Millan'),
('2026','A',5,'2026-10-10'::date,'16:00'::time,'17:30'::time,'Vicious','Ateker'),
('2026','A',5,'2026-10-11'::date,'08:00'::time,'09:30'::time,'Vicious','United'),
('2026','A',5,'2026-10-11'::date,'10:00'::time,'11:30'::time,'Maa','Ateker'),
('2026','A',5,'2026-10-11'::date,'12:00'::time,'13:30'::time,'Vulpes Nigra','Supersport'),
('2026','A',5,'2026-10-11'::date,'14:00'::time,'15:30'::time,'Chuka Boys','Chuka Sports Club'),
('2026','A',5,'2026-10-11'::date,'16:00'::time,'17:30'::time,'Chuka Santos','Veterans'),
('2026','A',6,'2026-10-14'::date,'12:00'::time,'13:30'::time,'United','Quest'),
('2026','A',6,'2026-10-14'::date,'14:00'::time,'15:30'::time,'Snipers','Millan'),
('2026','A',6,'2026-10-14'::date,'16:00'::time,'17:30'::time,'Chuka Sports Club','Veterans'),
('2026','A',6,'2026-10-15'::date,'12:00'::time,'13:30'::time,'Maa','Chuka Sports Club'),
('2026','A',6,'2026-10-15'::date,'14:00'::time,'15:30'::time,'Chuka Santos','Chuka Boys'),
('2026','A',6,'2026-10-15'::date,'16:00'::time,'17:30'::time,'Culsa','Veterans'),
('2026','B',1,'2026-09-10'::date,'12:00'::time,'13:30'::time,'Vipers','Cunsa'),
('2026','B',1,'2026-09-10'::date,'14:00'::time,'15:30'::time,'Pochon','Talanta'),
('2026','B',1,'2026-09-10'::date,'16:00'::time,'17:30'::time,'City Stars','Cuksa'),
('2026','B',1,'2026-09-11'::date,'10:00'::time,'11:30'::time,'Avengers','Young Stars'),
('2026','B',1,'2026-09-11'::date,'12:00'::time,'13:30'::time,'Pocusa','Rerina'),
('2026','B',1,'2026-09-11'::date,'14:00'::time,'15:30'::time,'Phelites','Thunder Elites'),
('2026','B',1,'2026-09-11'::date,'16:00'::time,'17:30'::time,'Ashland','Meru Boys'),
('2026','B',1,'2026-09-12'::date,'08:00'::time,'09:30'::time,'Vipers','Talanta'),
('2026','B',1,'2026-09-12'::date,'10:00'::time,'11:30'::time,'Cunsa','Cuksa'),
('2026','B',1,'2026-09-12'::date,'12:00'::time,'13:30'::time,'Pochon','Young Stars'),
('2026','B',1,'2026-09-12'::date,'14:00'::time,'15:30'::time,'City Stars','Rerina'),
('2026','B',1,'2026-09-12'::date,'16:00'::time,'17:30'::time,'Avengers','Thunder Elites'),
('2026','B',1,'2026-09-13'::date,'08:00'::time,'09:30'::time,'Pocusa','Meru Boys'),
('2026','B',1,'2026-09-13'::date,'10:00'::time,'11:30'::time,'Phelites','Ashland'),
('2026','B',1,'2026-09-13'::date,'12:00'::time,'13:30'::time,'Vipers','Cuksa'),
('2026','B',1,'2026-09-13'::date,'14:00'::time,'15:30'::time,'Talanta','Young Stars'),
('2026','B',1,'2026-09-13'::date,'16:00'::time,'17:30'::time,'Cunsa','Rerina'),
('2026','B',2,'2026-09-17'::date,'12:00'::time,'13:30'::time,'Pochon','Thunder Elites'),
('2026','B',2,'2026-09-17'::date,'14:00'::time,'15:30'::time,'City Stars','Meru Boys'),
('2026','B',2,'2026-09-17'::date,'16:00'::time,'17:30'::time,'Avengers','Ashland'),
('2026','B',2,'2026-09-18'::date,'10:00'::time,'11:30'::time,'Pocusa','Phelites'),
('2026','B',2,'2026-09-18'::date,'12:00'::time,'13:30'::time,'Vipers','Young Stars'),
('2026','B',2,'2026-09-18'::date,'14:00'::time,'15:30'::time,'Cuksa','Rerina'),
('2026','B',2,'2026-09-18'::date,'16:00'::time,'17:30'::time,'Talanta','Thunder Elites'),
('2026','B',2,'2026-09-19'::date,'08:00'::time,'09:30'::time,'Cunsa','Meru Boys'),
('2026','B',2,'2026-09-19'::date,'10:00'::time,'11:30'::time,'Pochon','Ashland'),
('2026','B',2,'2026-09-19'::date,'12:00'::time,'13:30'::time,'City Stars','Phelites'),
('2026','B',2,'2026-09-19'::date,'14:00'::time,'15:30'::time,'Avengers','Pocusa'),
('2026','B',2,'2026-09-19'::date,'16:00'::time,'17:30'::time,'Vipers','Rerina'),
('2026','B',2,'2026-09-20'::date,'08:00'::time,'09:30'::time,'Young Stars','Thunder Elites'),
('2026','B',2,'2026-09-20'::date,'10:00'::time,'11:30'::time,'Cuksa','Meru Boys'),
('2026','B',2,'2026-09-20'::date,'12:00'::time,'13:30'::time,'Talanta','Ashland'),
('2026','B',2,'2026-09-20'::date,'14:00'::time,'15:30'::time,'Cunsa','Phelites'),
('2026','B',2,'2026-09-20'::date,'16:00'::time,'17:30'::time,'Pochon','Pocusa'),
('2026','B',3,'2026-09-24'::date,'12:00'::time,'13:30'::time,'City Stars','Avengers'),
('2026','B',3,'2026-09-24'::date,'14:00'::time,'15:30'::time,'Vipers','Thunder Elites'),
('2026','B',3,'2026-09-24'::date,'16:00'::time,'17:30'::time,'Rerina','Meru Boys'),
('2026','B',3,'2026-09-25'::date,'10:00'::time,'11:30'::time,'Young Stars','Ashland'),
('2026','B',3,'2026-09-25'::date,'12:00'::time,'13:30'::time,'Cuksa','Phelites'),
('2026','B',3,'2026-09-25'::date,'14:00'::time,'15:30'::time,'Talanta','Pocusa'),
('2026','B',3,'2026-09-25'::date,'16:00'::time,'17:30'::time,'Cunsa','Avengers'),
('2026','B',3,'2026-09-26'::date,'08:00'::time,'09:30'::time,'Pochon','City Stars'),
('2026','B',3,'2026-09-26'::date,'10:00'::time,'11:30'::time,'Vipers','Meru Boys'),
('2026','B',3,'2026-09-26'::date,'12:00'::time,'13:30'::time,'Thunder Elites','Ashland'),
('2026','B',3,'2026-09-26'::date,'14:00'::time,'15:30'::time,'Rerina','Phelites'),
('2026','B',3,'2026-09-26'::date,'16:00'::time,'17:30'::time,'Young Stars','Pocusa'),
('2026','B',3,'2026-09-27'::date,'08:00'::time,'09:30'::time,'Cuksa','Avengers'),
('2026','B',3,'2026-09-27'::date,'10:00'::time,'11:30'::time,'Talanta','City Stars'),
('2026','B',3,'2026-09-27'::date,'12:00'::time,'13:30'::time,'Cunsa','Pochon'),
('2026','B',3,'2026-09-27'::date,'14:00'::time,'15:30'::time,'Vipers','Ashland'),
('2026','B',3,'2026-09-27'::date,'16:00'::time,'17:30'::time,'Meru Boys','Phelites'),
('2026','B',4,'2026-10-01'::date,'12:00'::time,'13:30'::time,'Thunder Elites','Pocusa'),
('2026','B',4,'2026-10-01'::date,'14:00'::time,'15:30'::time,'Rerina','Avengers'),
('2026','B',4,'2026-10-01'::date,'16:00'::time,'17:30'::time,'Young Stars','City Stars'),
('2026','B',4,'2026-10-02'::date,'10:00'::time,'11:30'::time,'Cuksa','Pochon'),
('2026','B',4,'2026-10-02'::date,'12:00'::time,'13:30'::time,'Talanta','Cunsa'),
('2026','B',4,'2026-10-02'::date,'14:00'::time,'15:30'::time,'Vipers','Phelites'),
('2026','B',4,'2026-10-02'::date,'16:00'::time,'17:30'::time,'Ashland','Pocusa'),
('2026','B',4,'2026-10-03'::date,'08:00'::time,'09:30'::time,'Meru Boys','Avengers'),
('2026','B',4,'2026-10-03'::date,'10:00'::time,'11:30'::time,'Thunder Elites','City Stars'),
('2026','B',4,'2026-10-03'::date,'12:00'::time,'13:30'::time,'Rerina','Pochon'),
('2026','B',4,'2026-10-03'::date,'14:00'::time,'15:30'::time,'Young Stars','Cunsa'),
('2026','B',4,'2026-10-03'::date,'16:00'::time,'17:30'::time,'Cuksa','Talanta'),
('2026','B',4,'2026-10-04'::date,'08:00'::time,'09:30'::time,'Vipers','Pocusa'),
('2026','B',4,'2026-10-04'::date,'10:00'::time,'11:30'::time,'Phelites','Avengers'),
('2026','B',4,'2026-10-04'::date,'12:00'::time,'13:30'::time,'Ashland','City Stars'),
('2026','B',4,'2026-10-04'::date,'14:00'::time,'15:30'::time,'Meru Boys','Pochon'),
('2026','B',4,'2026-10-04'::date,'16:00'::time,'17:30'::time,'Thunder Elites','Cunsa'),
('2026','B',5,'2026-10-08'::date,'12:00'::time,'13:30'::time,'Rerina','Talanta'),
('2026','B',5,'2026-10-08'::date,'14:00'::time,'15:30'::time,'Young Stars','Cuksa'),
('2026','B',5,'2026-10-08'::date,'16:00'::time,'17:30'::time,'Vipers','Avengers'),
('2026','B',5,'2026-10-09'::date,'10:00'::time,'11:30'::time,'Pocusa','City Stars'),
('2026','B',5,'2026-10-09'::date,'12:00'::time,'13:30'::time,'Phelites','Pochon'),
('2026','B',5,'2026-10-09'::date,'14:00'::time,'15:30'::time,'Ashland','Cunsa'),
('2026','B',5,'2026-10-09'::date,'16:00'::time,'17:30'::time,'Meru Boys','Talanta'),
('2026','B',5,'2026-10-10'::date,'08:00'::time,'09:30'::time,'Thunder Elites','Cuksa'),
('2026','B',5,'2026-10-10'::date,'10:00'::time,'11:30'::time,'Rerina','Young Stars'),
('2026','B',5,'2026-10-10'::date,'12:00'::time,'13:30'::time,'Vipers','City Stars'),
('2026','B',5,'2026-10-10'::date,'14:00'::time,'15:30'::time,'Avengers','Pochon'),
('2026','B',5,'2026-10-10'::date,'16:00'::time,'17:30'::time,'Pocusa','Cunsa'),
('2026','B',5,'2026-10-11'::date,'08:00'::time,'09:30'::time,'Phelites','Talanta'),
('2026','B',5,'2026-10-11'::date,'10:00'::time,'11:30'::time,'Ashland','Cuksa'),
('2026','B',5,'2026-10-11'::date,'12:00'::time,'13:30'::time,'Meru Boys','Young Stars'),
('2026','B',5,'2026-10-11'::date,'14:00'::time,'15:30'::time,'Thunder Elites','Rerina'),
('2026','B',5,'2026-10-11'::date,'16:00'::time,'17:30'::time,'Vipers','Pochon'),
('2026','B',6,'2026-10-14'::date,'12:00'::time,'13:30'::time,'City Stars','Cunsa'),
('2026','B',6,'2026-10-14'::date,'14:00'::time,'15:30'::time,'Avengers','Talanta'),
('2026','B',6,'2026-10-14'::date,'16:00'::time,'17:30'::time,'Pocusa','Cuksa'),
('2026','B',6,'2026-10-15'::date,'12:00'::time,'13:30'::time,'Phelites','Young Stars'),
('2026','B',6,'2026-10-15'::date,'14:00'::time,'15:30'::time,'Ashland','Rerina'),
('2026','B',6,'2026-10-15'::date,'16:00'::time,'17:30'::time,'Meru Boys','Thunder Elites')
)
insert into public.cpl_fixtures
  (season, home_team, away_team, home_team_id, away_team_id, match_date, venue, status, leg, competition, source_note)
select
  s.season,
  s.home_team,
  s.away_team,
  ht.id,
  away_t.id,
  ((s.match_date + s.kickoff) at time zone 'Africa/Nairobi'),
  null,
  'scheduled',
  'first_leg',
  'League',
  'Imported from official final-draft first-leg fixtures PDF; League ' || s.league ||
    ', Match Week ' || s.match_week || ', scheduled window ' ||
    to_char(s.kickoff,'HH12:MI AM') || '–' || to_char(s.scheduled_end,'HH12:MI AM') ||
    ' EAT. Venue/time may be revised by CPL officials. No score imported.'
from schedule s
left join public.cpl_teams ht on ht.season=s.season and ht.name=s.home_team
left join public.cpl_teams away_t on away_t.season=s.season and away_t.name=s.away_team
where not exists (
  select 1 from public.cpl_fixtures existing
  where existing.season=s.season
    and existing.leg='first_leg'
    and existing.competition='League'
    and lower(existing.home_team)=lower(s.home_team)
    and lower(existing.away_team)=lower(s.away_team)
    and existing.match_date is not null
    and (existing.match_date at time zone 'Africa/Nairobi')::date=s.match_date
);

-- CPL Cup scorer/assist sheets are stored as unconfirmed reference stats, not player registrations.
insert into public.cpl_imported_player_stats
  (season, competition, player_name, team_name, goals, assists, verification_status, source_document, notes)
values

('2026','CPL Cup','Dancun','Chuka Santos',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Vicko','Cuksa',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Hillary','City Stars',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','David','City Stars',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Wickliff','City Stars',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Ali','Avengers',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Klein','Millan',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Calvo','Young Stars',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Kim','Culsa',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Robert','Phelites',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Ouma','Veterans',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Unidentified (listed as N/A)','Pochon',1,0,'pending_confirmation','CPL_CUP_SCORERS_SHEET.pdf','Source sheet entry; confirmation was requested in the group. Source lists player name as N/A; do not match to a registered player until identified.'),
('2026','CPL Cup','Wafula','Chuka Santos',0,1,'pending_confirmation','CPL_CUP_ASSISTS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Lawrence','Cuksa',0,1,'pending_confirmation','CPL_CUP_ASSISTS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Jose','City Stars',0,1,'pending_confirmation','CPL_CUP_ASSISTS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Aleko','City Stars',0,1,'pending_confirmation','CPL_CUP_ASSISTS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Vinnie','Young Stars',0,1,'pending_confirmation','CPL_CUP_ASSISTS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Bradox','Culsa',0,1,'pending_confirmation','CPL_CUP_ASSISTS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Jake','Phelites',0,1,'pending_confirmation','CPL_CUP_ASSISTS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.'),
('2026','CPL Cup','Odo','Veterans',0,1,'pending_confirmation','CPL_CUP_ASSISTS_SHEET.pdf','Source sheet entry; confirmation was requested in the group.')
on conflict (season, competition, player_name, team_name) do nothing;

-- Transfer data: invalid transactions are historical rulings; later submissions are review-only.
insert into public.cpl_transfer_history
  (season, record_type, player_name, from_team, to_team, source_date, deadline, status, source_document, note)
values
('2026','invalid_after_deadline','Jaluo','United','Culsa','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Tobi','United','Culsa','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Taga','United','Culsa','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Ode','United','Culsa','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Roy','Supersport','Vulpes Nigra','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Mugoi','United','Vulpes Nigra','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Mark','Culsa','Maa','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Calvo','Culsa','Millan','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Collo','Culsa','Millan','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Yuvenus','Culsa','Maa','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Demarco','United','Maa','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','invalid_after_deadline','Ode','Ateker','Vulpes Nigra','2026-09-27'::date,'2026-09-20'::date,'invalidated_by_official_memo','Official Memorandum MEM/027/09/26','Declared null and void in official memo; player remains with original club. Do not update roster.'),
('2026','midseason_transfer_submission','Masha Thomas','City Stars','Vipers','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Victor Njuguna','Culsa','Chuka Sports Club','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Meshak Okedi','Vulpes Nigra','City Stars','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Eugine Ocampoz','Ateker','City Stars','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Lenny Munene','Vulpes Nigra','Chuka Santos','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Derrick David','Chuka Sports Club','Snipers','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Jared Enos','Ashland','Quest','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Hunter','City Stars','Quest','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Abel kasiwa','Vipers','Thunder Elites','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Austine Ochieng','Ateker','City Stars','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','lennox kimuni','Quest','Snipers','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Wakasiaka Abiud','Vulpes Nigra','Culsa','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Barack Ogalo','Millan','Culsa','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Fredrick mutuku','Vipers','Snipers','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Victor messi','Supersport','Maa','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Reuben Wambua','Vipers','Chuka Santos','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Moses odhiambo','Ashland','Snipers','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Emmannuel mutuku','City Stars','Young Stars','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Tagha','Culsa','Maa','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Davis faraa','Quest','Millan','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Frank Odhiambo','Snipers','Millan','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Izzoh','Maa','Supersport','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_transfer_submission','Benson Marwa','Avengers','Chuka Santos','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; player consent, signatures, identity and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Erick mutwiri','Free Agent','Vipers','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Collins kariuki','Free Agent','Vipers','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Victor mwaniki','Free Agent','Vipers','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Subsiro','Free Agent','City Stars','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Mashal','Free Agent','City Stars','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Lewis mutugi','Free Agent','Chuka Santos','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Alphonce Mugambi','Free Agent','Chuka Santos','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Domnic Nyasyo','Free Agent','Chuka Santos','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Dennis mugambi','Free Agent','Chuka Santos','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.'),
('2026','midseason_free_transfer_submission','Antony gachora','Free Agent','Vipers','2026-10-13'::date,'2026-10-13'::date,'submitted_for_review_not_approved','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','Group list only; free-agent status, player consent, registration and league approval must be checked before roster changes.')
on conflict (season, record_type, player_name, from_team, to_team) do nothing;

-- Official award categories and criteria; winners are not inferred from the source.
create table if not exists public.cpl_award_definitions (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  award_key text not null,
  title text not null,
  category text not null,
  criteria text not null,
  minimum_eligibility text,
  tie_breakers_or_notes text,
  source_document text not null,
  verification_status text not null default 'official_criteria_no_winners_imported',
  created_at timestamptz not null default now(),
  unique (season, award_key)
);
alter table public.cpl_award_definitions enable row level security;
drop policy if exists "CPL award definitions public read" on public.cpl_award_definitions;
create policy "CPL award definitions public read" on public.cpl_award_definitions for select using (true);
drop policy if exists "CPL admins manage award definitions" on public.cpl_award_definitions;
create policy "CPL admins manage award definitions" on public.cpl_award_definitions for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());

insert into public.cpl_award_definitions
  (season, award_key, title, category, criteria, minimum_eligibility, tie_breakers_or_notes, source_document, verification_status)
values
('2026','league_champions','League Champions','League Performance','Team with the highest total points at the end of the league season.','','Tiebreakers: goal difference, goals scored, then head-to-head record.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','league_first_run_up','First Run-up (league)','League Performance','Team finishing second in league standings at season end.','','','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','league_second_run_up','Second Run-up (league)','League Performance','Team finishing third in league standings at season end.','','','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','cup_champions','CPL Cup Champions','CPL Cup','Winner of the CPL Cup final.','','','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','cup_first_run_up','First Run-up (CPL Cup)','CPL Cup','Runner-up in the CPL Cup final.','','','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','cup_second_run_up','Second Run-up (CPL Cup)','CPL Cup','Best-performing losing semifinalist in the CPL Cup competition.','','','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','player_of_season','CPL Player of the Season (league A/B)','Individual Performance','Most outstanding individual selected through combined vote of CPL Technical Committee and Registered CPL Referee Council.','','','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','golden_glove_league','Golden Glove (league A/B)','Individual Performance','Goalkeeper with the most clean sheets in the league season.','10 league appearances','Tiebreaker: fewer goals conceded per match.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','golden_glove_cup','Golden Glove (CPL Cup)','Individual Performance','Goalkeeper with the most clean sheets in the CPL Cup tournament.','3 cup appearances','Tiebreaker: fewer goals conceded in the knockout stage.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','golden_boot_league','Golden Boot (league A/B)','Individual Performance','Player with the most goals scored in the league season.','10 league appearances','Tiebreakers: fewest penalties scored, fewer matches played, then more assists.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','golden_boot_cup','Golden Boot (CPL Cup)','Individual Performance','Player with the most goals scored in the CPL Cup tournament.','3 cup appearances','Knockout-stage goals prioritized, then fewer penalties scored.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','playmaker_league','Playmaker/Most Assists (league A/B)','Individual Performance','Player with the most assists in the league season.','10 league appearances','Tiebreakers: fewer matches played, then fewer disciplinary points.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','playmaker_cup','Playmaker/Most Assists (CPL Cup)','Individual Performance','Player with the most assists in the CPL Cup tournament.','3 cup appearances','Knockout-stage assists prioritized, then fewer matches played.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','best_manager','CPL Best Manager of the Season','Technical and Officiating','Manager achieving the best league standings relative to squad quality, tactical innovation and clean disciplinary record; no red card to technical bench.','','Selected by CPL Technical Committee and CPL Registered Referee Council.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','best_referee','CPL Best Referee of the Season (Inclusive of AR)','Technical and Officiating','On-field centre or assistant referee with highest average match assessor ratings and no controversial decisions overturned by CPL Review Panel.','10 matches officiated','','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','best_young_player','CPL Best Young Player','Special Recognition','Player aged 23 or under as season begins, with at least 5 goals, assists or tackles won in league; performance relative to age, consistency and growth trajectory.','','','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','most_disciplined_player','CPL Most Disciplined Player','Special Recognition','Player with zero red cards and fewest yellow cards, no misconduct reports or fines.','10 league appearances','Selected by CPL Registered Referees Panel and CPL Technical Committee.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','team_of_season','CPL Team of the Season','Special Recognition','Best XI selected on clean sheets, tackles won, interceptions, assists, pass completion, chances created, goals scored and shots on target.','','Selected by CPL Technical Committee.','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','most_disciplined_team','CPL Most Disciplined Team','Special Recognition','Team with lowest disciplinary points: 3 per red card and 1 per yellow card; zero fines or misconduct sanctions and positive referee reports.','','','AWARDS.pdf','official_criteria_no_winners_imported'),
('2026','best_official','CPL Best Official of the Season','Technical and Officiating','Non-refereeing CPL Organizing Committee official assessed on organizational efficiency, zero match reporting errors, punctuality and stakeholder feedback.','','Selected by Technical bench (Coaches) and CPL Refereeing Council.','AWARDS.pdf','official_criteria_no_winners_imported')
on conflict (season, award_key) do nothing;

-- Source-captured rules, fees and sanctions are evidence records, not automatic fee/payment state.
create table if not exists public.cpl_imported_rules (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  rule_key text not null,
  value_text text not null,
  verification_status text not null,
  source_document text not null,
  notes text not null,
  created_at timestamptz not null default now(),
  unique (season, rule_key)
);
create table if not exists public.cpl_imported_disciplinary_records (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  reference text not null,
  notice_date date,
  club text not null,
  amount_ksh numeric(10,2) not null check (amount_ksh >= 0),
  reason text not null,
  status text not null,
  source_document text not null,
  notes text not null,
  created_at timestamptz not null default now(),
  unique (season, reference, club, amount_ksh)
);
alter table public.cpl_imported_rules enable row level security;
alter table public.cpl_imported_disciplinary_records enable row level security;
drop policy if exists "CPL imported rules public read" on public.cpl_imported_rules;
create policy "CPL imported rules public read" on public.cpl_imported_rules for select using (true);
drop policy if exists "CPL admins manage imported rules" on public.cpl_imported_rules;
create policy "CPL admins manage imported rules" on public.cpl_imported_rules for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());
drop policy if exists "CPL imported disciplinary records public read" on public.cpl_imported_disciplinary_records;
create policy "CPL imported disciplinary records public read" on public.cpl_imported_disciplinary_records for select using (true);
drop policy if exists "CPL admins manage imported disciplinary records" on public.cpl_imported_disciplinary_records;
create policy "CPL admins manage imported disciplinary records" on public.cpl_imported_disciplinary_records for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());

insert into public.cpl_imported_rules (season, rule_key, value_text, verification_status, source_document, notes) values
('2026','team_registration_fee_january_minutes','KSh 5,000; minutes say payment due by 30 January 2026','conflicting_sources_needs_chairman_review','CPL officials meeting minutes posted 22 Jan 2026','A later 9 Sep 2026 chairperson post lists KSh 6,000 for selected teams. Do not set or charge fees automatically from these mentions.'),
('2026','team_registration_fee_september_post','KSh 6,000 listed for Talanta, Avengers, Pochon, Chuka Sports Club, Thunder Elites, United and Cuksa','conflicting_sources_needs_chairman_review','WhatsApp post CPL REGISTRATION, 9 Sep 2026','The post lists selected teams only; does not establish a universal fee or payment receipt.'),
('2026','maximum_squad_size','Maximum 25 registered players per team','source_recorded','CPL officials meeting minutes posted 22 Jan 2026','Teams were instructed to provide registered-player lists at the next meeting.'),
('2026','match_duration','80 minutes total: 40-minute first half and 40-minute second half','source_recorded','CPL meeting resolutions posted 6 Sep 2026','Imported as a recorded rule; confirm whether later amendments exist.'),
('2026','match_card_requirement','All players must have valid CPL match cards before participating; no player without a valid card may play','source_recorded','CPL meeting resolutions posted 6 Sep 2026','The stated deadline was 8 September 2026; deadline is historical.'),
('2026','team_registration_deadline','15 September 2026; teams failing to complete registration were to be expelled','historical_deadline','CPL registration notice posted 7 Sep 2026','Do not infer current payment status or team eligibility from the notice alone.'),
('2026','chogoria_max_matches_per_matchday','Teams travelling to Chogoria should play a maximum of two matches that matchday','source_recorded','CPL officials meeting minutes posted 22 Jan 2026','Operational scheduling rule; venue schedules may change.'),
('2026','midseason_transfer_deadline','Transfer submissions deadline 13 October 2026, 11:59 PM; late submissions not accepted','historical_deadline','WhatsApp post titled Mid-Season Transfers, 13 Oct 2026','The submitted transfer list remains subject to consent, signature and league review.')
on conflict (season, rule_key) do nothing;

insert into public.cpl_imported_disciplinary_records
  (season, reference, notice_date, club, amount_ksh, reason, status, source_document, notes)
values
('2026','CPL/DIS/012/26','2026-09-25'::date,'Culsa FC',500,'Official disciplinary sanction for physical altercation involving Culsa FC head coach and an Ateker FC supporter','fine_issued_payment_not_verified','Official disciplinary notice posted 25 Sep 2026','Notice says fine must be paid before next scheduled game and no game should be played until cleared. Payment receipt not present in export.'),
('2026','CPL/DIS/012/26','2026-09-25'::date,'Ateker FC',500,'Official disciplinary sanction for physical altercation involving Culsa FC head coach and an Ateker FC supporter','fine_issued_payment_not_verified','Official disciplinary notice posted 25 Sep 2026','Notice says fine must be paid before next scheduled game and no game should be played until cleared. Payment receipt not present in export.'),
('2026','JAN-MINUTES-2026-01-21','2026-01-21'::date,'Supersport',5000,'Historical arrears reported in CPL officials meeting minutes','reported_arrears_payment_not_verified','CPL officials meeting minutes posted 22 Jan 2026','Minutes say arrears must be cleared before participation. This is a historical report, not proof of current balance.'),
('2026','JAN-MINUTES-2026-01-21','2026-01-21'::date,'Milan FC / Millan',500,'Historical arrears reported in CPL officials meeting minutes','reported_arrears_payment_not_verified','CPL officials meeting minutes posted 22 Jan 2026','Minutes say arrears must be cleared before participation. Team spelling differs from later fixture PDF; verify identity and current balance.')
on conflict (season, reference, club, amount_ksh) do nothing;

-- Reported scores are candidates for review only and never update official fixtures/standings.
create table if not exists public.cpl_imported_result_candidates (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026',
  match_date date not null,
  competition text not null,
  league text check (league is null or league in ('A','B')),
  home_team text not null,
  away_team text not null,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  source_author text not null,
  source_message text not null,
  source_date date,
  status text not null default 'pending_chairman_verification'
    check (status in ('pending_chairman_verification','confirmed_and_linked','rejected')),
  notes text not null,
  created_at timestamptz not null default now(),
  unique (season, match_date, competition, home_team, away_team, home_score, away_score, source_message)
);
alter table public.cpl_imported_result_candidates enable row level security;
drop policy if exists "CPL imported result candidates public read" on public.cpl_imported_result_candidates;
create policy "CPL imported result candidates public read" on public.cpl_imported_result_candidates for select using (true);
drop policy if exists "CPL admins manage result candidates" on public.cpl_imported_result_candidates;
create policy "CPL admins manage result candidates" on public.cpl_imported_result_candidates for all using (public.cpl_is_admin()) with check (public.cpl_is_admin());

insert into public.cpl_imported_result_candidates
  (season, match_date, competition, league, home_team, away_team, home_score, away_score, source_author, source_message, source_date, status, notes)
values
('2026','2026-09-14'::date,'League','A','Culsa','Chuka Boys',4,1,'+254 783 621514','Today’s Results; Chuka Boys section','2026-09-14'::date,'pending_chairman_verification','WhatsApp result post; not chairman-approved in app.'),
('2026','2026-09-14'::date,'League','A','Veterans','Supersport',0,3,'+254 783 621514','Today’s Results; Veterans v Supersport','2026-09-14'::date,'pending_chairman_verification','WhatsApp result post; not chairman-approved in app.'),
('2026','2026-09-21'::date,'CPL Cup',NULL,'Culsa','Veterans',3,1,'@Cpl_Chairperson','CPL CUP RESULTS','2026-09-21'::date,'pending_chairman_verification','Chairperson-posted cup score; still requires entry/confirmation in the app.'),
('2026','2026-09-27'::date,'League','B','City Stars','Pocusa',0,0,'@Marvonesh001','TODAY’S FIXTURES (Chuka Boys); score below fixture','2026-09-27'::date,'pending_chairman_verification','Team spelling in post: Pokuca. Candidate result, not approved in app.'),
('2026','2026-09-27'::date,'League','B','Avengers','Cuksa',0,1,'@Marvonesh001','TODAY’S FIXTURES (Chuka Boys); score below fixture','2026-09-27'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-09-27'::date,'League','B','Ashland','Vipers',1,0,'@Marvonesh001','TODAY’S FIXTURES (Chuka Boys); score below fixture','2026-09-27'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-09-27'::date,'League','B','Phelites','Pochon',0,1,'@Marvonesh001 and @ltsMeGichobi','TODAY’S FIXTURES and follow-up result','2026-09-27'::date,'pending_chairman_verification','Score repeated in a follow-up message; not approved in app.'),
('2026','2026-09-27'::date,'League','A','Chuka Sports Club','Chuka Santos',1,1,'@Marvonesh001','TODAY’S LEAGUE A RESULTS','2026-09-27'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-09-27'::date,'League','A','Snipers','Quest',1,0,'@Marvonesh001','TODAY’S LEAGUE A RESULTS','2026-09-27'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-09-27'::date,'League','A','Millan','United',0,1,'@Marvonesh001','TODAY’S LEAGUE A RESULTS','2026-09-27'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-09-27'::date,'League','A','Chuka Sports Club','Culsa',3,2,'@Marvonesh001 and +254 757 314080','TODAY’S LEAGUE A RESULTS; score corrected by reply','2026-09-27'::date,'pending_chairman_verification','Initial post displayed Culsa 2–3 Chuka Sports; reply corrected it to Chuka Sports 3–2 Culsa and reporter replied “Corrected”. Use corrected score only after review.'),
('2026','2026-09-27'::date,'League','A','Ateker','Supersport',0,5,'@Marvonesh001','TODAY’S LEAGUE A RESULTS','2026-09-27'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-10-13'::date,'League','A','Snipers','Millan',2,0,'@Marvonesh001','TODAY’S RESULTS','2026-10-13'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-10-13'::date,'League','A','Supersport','Ateker',0,0,'@Marvonesh001','TODAY’S RESULTS','2026-10-13'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-10-13'::date,'League','A','Vulpes Nigra','Maa',3,1,'@Marvonesh001','TODAY’S RESULTS','2026-10-13'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-10-13'::date,'League','B','City Stars','Vipers',1,3,'@Marvonesh001','TODAY’S RESULTS','2026-10-13'::date,'pending_chairman_verification','Candidate result, not approved in app.'),
('2026','2026-10-13'::date,'League','B','Avengers','Young Stars',0,2,'@Marvonesh001','TODAY’S RESULTS','2026-10-13'::date,'pending_chairman_verification','Source spelling: Youngsters. Candidate result, not approved in app.'),
('2026','2026-10-13'::date,'League','B','Thunder Elites','Phelites',1,0,'@Marvonesh001','TODAY’S RESULTS','2026-10-13'::date,'pending_chairman_verification','Source spelling: Thunder. Candidate result, not approved in app.'),
('2026','2026-10-13'::date,'League','A','Veterans','Chuka Sports Club',1,2,'@Marvonesh001','TODAY’S RESULTS','2026-10-13'::date,'pending_chairman_verification','Candidate result, not approved in app.')
on conflict (season, match_date, competition, home_team, away_team, home_score, away_score, source_message) do nothing;

-- Explicit grants for Supabase API roles; RLS policies above still gate all writes.
grant select on public.cpl_import_sources, public.cpl_imported_player_stats, public.cpl_transfer_history,
  public.cpl_award_definitions, public.cpl_imported_rules, public.cpl_imported_disciplinary_records,
  public.cpl_imported_result_candidates to anon, authenticated;
grant insert, update, delete on public.cpl_import_sources, public.cpl_imported_player_stats, public.cpl_transfer_history,
  public.cpl_award_definitions, public.cpl_imported_rules, public.cpl_imported_disciplinary_records,
  public.cpl_imported_result_candidates to authenticated;
grant all on public.cpl_import_sources, public.cpl_imported_player_stats, public.cpl_transfer_history,
  public.cpl_award_definitions, public.cpl_imported_rules, public.cpl_imported_disciplinary_records,
  public.cpl_imported_result_candidates to service_role;
grant usage, select on sequence public.cpl_import_sources_id_seq to authenticated;
grant all on sequence public.cpl_import_sources_id_seq to service_role;

commit;
