-- Fish Tracker initial schema
-- Run this in the Supabase SQL Editor (or via `supabase db push` if you use the CLI).
--
-- Privacy model, enforced at the database layer (not just in the UI):
--   * `guests` holds last names for internal linking only. There is NO select
--     policy for the public `anon` role — it cannot be read by the entry form,
--     the catch log/chart view, or a raw REST call with the anon key.
--   * Public writes (the digital entry form) go through the `get_or_create_guest`
--     function, which is SECURITY DEFINER: it can look up/create a guest row
--     without the caller ever being granted SELECT on `guests`.
--   * `catch_entries` carries `guest_id` for internal linking. `anon` can select
--     rows it just inserted (needed so the entry form can read back a new row's
--     id), but a COLUMN-level grant excludes `guest_id` entirely, so anon can
--     never select that column no matter what it queries. The public
--     chart/table page reads from the `public_catch_log` view instead, which
--     omits `guest_id` and any name altogether.
--   * Only the `authenticated` role (the single logged-in login) can read
--     `guests`, `family_notes`, and `family_photos`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum for species
-- ---------------------------------------------------------------------------
create type species_type as enum (
  'coho', 'chinook', 'pink', 'chum', 'sockeye', 'steelhead', 'other'
);

-- ---------------------------------------------------------------------------
-- Guests (internal linking only — never exposed to anon)
-- ---------------------------------------------------------------------------
create table guests (
  id uuid primary key default gen_random_uuid(),
  last_name text not null,
  created_at timestamptz not null default now()
);

-- case-insensitive uniqueness so "Smith" and "smith" are the same guest
create unique index guests_last_name_lower_idx on guests (lower(last_name));

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------
create table trips (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  pilot text,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  constraint trips_end_after_start check (end_date is null or end_date >= start_date)
);

create index trips_start_date_idx on trips (start_date);

-- ---------------------------------------------------------------------------
-- Catch entries (one per guest/date/river). guest_id + trip_id are for
-- internal linking only — never selectable by anon.
-- ---------------------------------------------------------------------------
create table catch_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips (id) on delete set null,
  guest_id uuid references guests (id) on delete set null,
  entry_date date not null,
  river text not null,
  created_at timestamptz not null default now()
);

create index catch_entries_entry_date_idx on catch_entries (entry_date);
create index catch_entries_river_idx on catch_entries (river);
create index catch_entries_trip_id_idx on catch_entries (trip_id);
create index catch_entries_guest_id_idx on catch_entries (guest_id);

-- ---------------------------------------------------------------------------
-- Catch counts (one row per species caught within an entry)
-- ---------------------------------------------------------------------------
create table catch_counts (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references catch_entries (id) on delete cascade,
  species species_type not null,
  other_species_label text,
  count integer not null check (count >= 0),
  created_at timestamptz not null default now(),
  constraint catch_counts_other_label_required check (
    species <> 'other' or (other_species_label is not null and length(trim(other_species_label)) > 0)
  )
);

create index catch_counts_entry_id_idx on catch_counts (entry_id);
create index catch_counts_species_idx on catch_counts (species);

-- ---------------------------------------------------------------------------
-- Family notes (login-gated section — built in a later phase, schema now)
-- ---------------------------------------------------------------------------
create table family_notes (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  trip_id uuid references trips (id) on delete set null,
  year integer not null,
  note_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index family_notes_guest_id_idx on family_notes (guest_id);
create index family_notes_year_idx on family_notes (year);

-- ---------------------------------------------------------------------------
-- Family photos (login-gated section — built in a later phase, schema now)
-- Actual Supabase Storage bucket + policies will be added when we build the
-- photo upload feature.
-- ---------------------------------------------------------------------------
create table family_photos (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  trip_id uuid references trips (id) on delete set null,
  year integer not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index family_photos_guest_id_idx on family_photos (guest_id);
create index family_photos_year_idx on family_photos (year);

-- ---------------------------------------------------------------------------
-- Public view: river x species x date, with NO guest name / guest_id, and NO
-- group_name either (a fishing group is often named after the family, so
-- treat it as identifying). trip_label is a non-identifying stand-in
-- ("Trip 1", "Trip 2", ...) generated from trip order, purely so entries
-- from the same trip can still be told apart on the public page.
-- This is the only thing the public entry/chart pages ever select from.
-- ---------------------------------------------------------------------------
create view public_catch_log as
select
  ce.id as entry_id,
  ce.entry_date,
  ce.river,
  'Trip ' || dense_rank() over (order by t.start_date, t.id) as trip_label,
  t.pilot,
  cc.id as count_id,
  cc.species,
  cc.other_species_label,
  cc.count
from catch_entries ce
join trips t on t.id = ce.trip_id
join catch_counts cc on cc.entry_id = ce.id;

-- ---------------------------------------------------------------------------
-- get_or_create_guest: lets the public entry form link an entry to a guest
-- last name without ever granting SELECT on `guests` to anon. Returns a uuid
-- either way, so it can't be used to probe whether a name already exists.
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_guest(p_last_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_clean text := trim(p_last_name);
begin
  if v_clean is null or length(v_clean) = 0 then
    raise exception 'last_name is required';
  end if;

  select id into v_id from guests where lower(last_name) = lower(v_clean);

  if v_id is null then
    insert into guests (last_name) values (v_clean) returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.get_or_create_guest(text) from public;
grant execute on function public.get_or_create_guest(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table guests enable row level security;
alter table trips enable row level security;
alter table catch_entries enable row level security;
alter table catch_counts enable row level security;
alter table family_notes enable row level security;
alter table family_photos enable row level security;

-- guests: no anon policies at all (writes go through get_or_create_guest above)
create policy "authenticated can read guests" on guests
  for select to authenticated using (true);
create policy "authenticated can manage guests" on guests
  for all to authenticated using (true) with check (true);

-- trips: public entry form needs to create trips and list them (no guest data here)
create policy "anon can insert trips" on trips
  for insert to anon with check (true);
create policy "anon can read trips" on trips
  for select to anon using (true);
create policy "authenticated can manage trips" on trips
  for all to authenticated using (true) with check (true);

-- catch_entries: anon can insert (the entry form) and read back the row it
-- just created (the app calls .select('id') after insert to link
-- catch_counts to it). guest_id stays hidden from anon at the COLUMN
-- privilege level below, regardless of this row-level policy — the public
-- chart/table still reads only from public_catch_log.
create policy "anon can insert catch_entries" on catch_entries
  for insert to anon with check (true);
create policy "anon can select catch_entries" on catch_entries
  for select to anon using (true);
create policy "authenticated can manage catch_entries" on catch_entries
  for all to authenticated using (true) with check (true);

-- catch_counts: same shape as catch_entries
create policy "anon can insert catch_counts" on catch_counts
  for insert to anon with check (true);
create policy "authenticated can manage catch_counts" on catch_counts
  for all to authenticated using (true) with check (true);

-- family_notes / family_photos: authenticated (the single guest-info login) only.
-- No anon policies -> anon has zero access, by default deny.
create policy "authenticated can manage family_notes" on family_notes
  for all to authenticated using (true) with check (true);
create policy "authenticated can manage family_photos" on family_photos
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Grants (RLS policies only take effect once the underlying privilege exists)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert on trips to anon;
grant all on trips to authenticated;

grant insert on catch_entries to anon;
-- Column-level grant, deliberately excluding guest_id: even though the RLS
-- policy above allows selecting rows, Postgres still blocks anon from ever
-- selecting the guest_id column itself (e.g. `select guest_id from
-- catch_entries` fails for anon regardless of RLS).
grant select (id, trip_id, entry_date, river, created_at) on catch_entries to anon;
grant all on catch_entries to authenticated;

grant insert on catch_counts to anon;
grant all on catch_counts to authenticated;

grant select on public_catch_log to anon, authenticated;

grant select, insert, update, delete on guests to authenticated;
grant select, insert, update, delete on family_notes to authenticated;
grant select, insert, update, delete on family_photos to authenticated;
