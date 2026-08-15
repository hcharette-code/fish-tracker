-- One-off fix: merges the "Ahnuahti River" typo into "Ahnuhati River"
-- (the correct spelling used elsewhere). Run once in the SQL Editor, then
-- discard — not a migration.
update catch_entries set river = 'Ahnuhati River' where river = 'Ahnuahti River';
