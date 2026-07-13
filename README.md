# Roundtrip — shared trip companion

Plan a trip together and carry it with you: itinerary with per-day weather and
outfit advice, outfit planner with photos, packing lists, shared budget with
settle-up, and a booking checklist. Create a trip in the app, share a 6-letter
code, and everyone stays in sync in near real-time.

Built with Vite + React + Tailwind CSS on Supabase (anonymous-first auth with
optional email/Google account linking). Installable as a PWA — works offline.

## Develop

```bash
npm install
npm run dev
```

## Backend setup (one-time)

The app uses a free [Supabase](https://supabase.com) project for sync + auth.
Follow [`supabase/SETUP.md`](supabase/SETUP.md): create the project, run
[`supabase/schema.sql`](supabase/schema.sql) **once** (never again — it drops
the tables), run [`supabase/migrations/001_public_hardening.sql`](supabase/migrations/001_public_hardening.sql),
enable the auth providers, and put your project URL + anon key in `.env.local`.

## How trips work

- **Create a trip** in the app: name, dates, currency (plus an optional second
  display currency and budget), then search-and-add destinations — each day is
  assigned to a destination automatically and can be edited afterwards.
- **Share the trip code** so others can join. Everyone sees the whole trip,
  with each person's additions labelled.
- **Your trips** home screen lists every trip you're on and who's on it.
- **Accounts are optional**: everything works as a guest (this browser only).
  Linking an email or Google account keeps the same identity and unlocks your
  trips on any device.

## Where the data lives

Everything is stored in **Supabase** and mirrored to **IndexedDB on each
device** as an offline cache with a write outbox.

- **Shared** by all members: the trip definition (days, destinations, money
  settings), shared day notes, expenses (who-paid + settle-up), bookings.
- **Personal** per member: packing list, outfit photos, own per-day notes.
- **↓ Backup data** in the header downloads a JSON backup of the current trip;
  **↑ Restore** loads one back.

If you ever want to swap the backend, everything network-related lives in
`src/lib/supabase.js`, `src/lib/session.js`, `src/lib/auth.js`, and `src/lib/storage.js`.

## Deploy to Vercel

1. Push the repo to GitHub and import it on [vercel.com](https://vercel.com)
   (framework preset: Vite).
2. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (Production + Preview). The anon key is safe in the client — Row-Level
   Security is the boundary.
3. In Supabase **Authentication → URL Configuration**, add the Vercel URL to
   the redirect allowlist (needed for Google OAuth / email links).

## Structure

```
src/
  App.jsx                    shell: routing (gate → trips home → trip), header, tabs
  theme.js                   app name + chrome colours
  data/currencies.js         currency picker list
  data/exampleTrips/         archived original trip + legacy upgrade seed
  lib/tripConfig.js          per-trip config context + date/money helpers
  lib/session.js             trip create/join/enter, members, trips list
  lib/auth.js                account linking + sign-in (email OTP, Google)
  lib/storage.js             Supabase kv + IndexedDB cache + backup/restore
  lib/weather.js             Open-Meteo forecast, cached + synced
  lib/outfitAdvisor.js       rule-based outfit suggestions
  lib/geocode.js             Open-Meteo place search
  lib/legacyMigration.js     one-time upgrade of the pre-wizard trip
  components/                shared UI (wizard, settings, trips home, …)
  tabs/                      one file per tab
supabase/
  schema.sql                 first-time schema (DO NOT re-run)
  migrations/                additive SQL to run after first setup
```
