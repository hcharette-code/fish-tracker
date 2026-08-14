-- One-off cleanup: removes the test entries created while verifying the app
-- ("Anderson Party" / guest "Anderson", "Smith Party" / guest "Smith").
-- Run this once in the Supabase SQL Editor, then discard this file — it's
-- not a migration, just a cleanup script.

delete from catch_counts
where entry_id in (
  select ce.id from catch_entries ce
  join trips t on t.id = ce.trip_id
  where t.group_name in ('Anderson Party', 'Smith Party')
);

delete from catch_entries
where trip_id in (
  select id from trips where group_name in ('Anderson Party', 'Smith Party')
);

delete from trips where group_name in ('Anderson Party', 'Smith Party');

delete from guests where lower(last_name) in ('anderson', 'smith');
