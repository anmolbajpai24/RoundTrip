# Roundtrip — shared trip companion

Plan a trip together and carry it with you: itinerary with per-day weather and
outfit advice, a trip map, outfit planner with photos, packing lists, shared
budget with settle-up, a booking checklist, and a documents wallet for tickets
and PDFs. Create a trip in the app, share a 6-letter code, and everyone stays
in sync in near real-time. Light and dark themes.

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
the tables), run [`supabase/migrations/001_public_hardening.sql`](supabase/migrations/001_public_hardening.sql)
and [`supabase/migrations/002_documents_storage.sql`](supabase/migrations/002_documents_storage.sql)
(both additive and live-safe), enable the auth providers, and put your project
URL + anon key in `.env.local`.

### Optional: trip cover photos (Unsplash)

Trip cards use a colour gradient by default. To offer real destination photos,
create a free [Unsplash developer app](https://unsplash.com/developers) and add
its Access Key to `.env.local` (and Vercel):

```
VITE_UNSPLASH_ACCESS_KEY=your-access-key
```

Photos are only fetched from the trip wizard and trip settings, so the demo
tier's 50 requests/hour is plenty.

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
  settings, cover photo), shared day notes, expenses (who-paid + settle-up),
  bookings, and the document list (files themselves live in a private
  Supabase Storage bucket, member-only).
- **Personal** per member: packing list, outfit photos, own per-day notes.
- **Profile** (display name + colour) lives in auth user metadata and follows
  your account across trips and devices.
- **↓ Backup data** in the header downloads a JSON backup of the current trip;
  **↑ Restore** loads one back.

If you ever want to swap the backend, everything network-related lives in
`src/lib/supabase.js`, `src/lib/session.js`, `src/lib/auth.js`, and `src/lib/storage.js`.

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
  lib/profile.js             global display name/colour (auth user metadata)
  lib/unsplash.js            optional trip cover photos
  lib/documents.js           documents wallet (Supabase Storage)
  lib/legacyMigration.js     one-time upgrade of the pre-wizard trip
  components/                shared UI (wizard, settings, trips home, …)
  tabs/                      one file per tab
supabase/
  schema.sql                 first-time schema (DO NOT re-run)
  migrations/                additive SQL to run after first setup
```
