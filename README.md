# Fish Tracker

Tracks fish-camp catch reports (date, pilot, group, per-guest catch entries by
river/species) with a public catch log and a login-gated guest-info section.

## Status

This is phase 1: project structure, Supabase schema, and the digital entry
form + public catch log. Not yet built (coming next):

- Photo upload of handwritten reports with OCR extraction + editable review screen
- Login-gated guest information section (family list, notes, photos per year)
- Chart visualization on top of the current table view

## Privacy model

- Guest last names are **never** queried or rendered on the entry form or
  catch log. Those pages only ever read from the `public_catch_log` database
  view, which has no guest name / guest id column at all.
- The entry form still collects a guest last name (for internal linking), but
  it's sent straight to a `get_or_create_guest` database function and never
  read back. The public `anon` role has **no SELECT permission** on the
  `guests` or `catch_entries` tables — this is enforced by Postgres Row Level
  Security, not just hidden in the UI, so it holds even if someone queries the
  Supabase REST API directly with the public anon key.
- Only the single authenticated login (guest-info section, built in a later
  phase) can read guest names, notes, and photos.

See the comments in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
for the full policy set.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the SQL Editor, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. In **Authentication → Users**, click "Add user" and create the single login:
   - Email: `hcharette@wcheli.com`
   - Password: `WCHeli10`
   - Supabase hashes this with bcrypt in `auth.users` — it's never stored in
     plain text, and the app never re-implements its own hashing.
   - This account isn't wired into the UI yet (that's the guest-info-section
     phase) — creating it now just gets it ready.
4. In **Project Settings → API**, copy the **Project URL** and **anon public**
   key for the next step.

## 2. Configure the frontend

You'll need [Node.js](https://nodejs.org) 18+ installed locally (this
environment didn't have Node available, so the project was hand-written but
not yet `npm install`-ed or build-verified — do that first).

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in the two values from Supabase step 4 above.

```bash
npm install
npm run dev
```

Open the printed local URL. You should see the "Enter Catch Report" form; use
it to save a report, then check "Catch Log" to confirm it shows up (with no
guest name).

## 3. Deploy to Netlify

1. Push this project to a Git repo (GitHub/GitLab/Bitbucket).
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
   Build command and publish directory are already set via `netlify.toml`
   (`npm run build` / `dist`).
3. In **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (same values as `.env.local`)
4. Deploy. The `netlify.toml` redirect rule makes client-side routes like
   `/catch-log` work on refresh/direct link.

## Project structure

```
supabase/migrations/0001_init.sql   Full DB schema, RLS policies, public view
src/lib/supabaseClient.ts           Supabase client (reads env vars)
src/types/fish.ts                   Species enum + shared types
src/pages/EntryForm.tsx             Digital entry form (trip + catch entries)
src/pages/CatchLog.tsx              Public river × species table, filterable
src/components/Nav.tsx              Top nav
netlify.toml                        Netlify build + SPA redirect config
```

## Data model

- **trips**: group_name, pilot, start_date, end_date
- **guests**: last_name only (internal linking; never exposed to `anon`)
- **catch_entries**: trip_id, guest_id, entry_date, river
- **catch_counts**: entry_id, species, other_species_label, count (one row
  per species caught on a given entry, so an entry can report several
  species at once)
- **family_notes** / **family_photos**: schema in place for the login-gated
  guest-info phase (year, notes, photo storage path) — not wired into the UI
  yet.
