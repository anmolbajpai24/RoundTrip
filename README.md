# London & the Loop — UK Trip Companion

Personal trip companion app for the UK trip, 7–30 Aug 2026. Itinerary, outfit planner, packing list, budget tracker, and booking checklist.

Built with Vite + React + Tailwind CSS. Installable as a PWA (works offline).
Data syncs across devices via Supabase, with two profiles (Me / Her).

## Develop

```bash
npm install
npm run dev
```

## Enable cross-device sync (one-time)

The app uses a free [Supabase](https://supabase.com) project for syncing.
Follow [`supabase/SETUP.md`](supabase/SETUP.md): create the project, run
[`supabase/schema.sql`](supabase/schema.sql), turn on anonymous sign-in, and
put your project URL + anon key in `.env.local` (copy from `.env.example`).

On first launch each device does a quick onboarding: **create a trip** (get a
short code) on one phone, then **join with that code** on the other. Pick your
profile (Me / Her) and you're synced.

## Deploy to Vercel

Either connect the repo on [vercel.com](https://vercel.com) (framework auto-detected as Vite), or:

```bash
npm i -g vercel
vercel
```

## Where the data lives

Everything you enter is stored in **Supabase** (a hosted database) and mirrored to **IndexedDB on each device** as an offline cache. The two of you stay in sync automatically, in near real-time.

- **Shared** between both of you: the itinerary base notes, the expense/budget tracker (with who-paid + settle-up), and the booking checklist.
- **Personal** to each profile: packing list, outfit photos, and your own per-day itinerary notes ("My notes").
- Works **offline** — changes are cached locally and pushed up when you're back online.
- Use **↓ Backup data** in the header to download a JSON backup of the current trip, and **↑ Restore** to load one back.
- On iPhone: **add the app to your home screen** (Share → Add to Home Screen) for the most durable offline cache.

If you ever want to swap the backend, everything network-related lives in `src/lib/supabase.js`, `src/lib/session.js`, and `src/lib/storage.js`.

## Structure

```
src/
  App.jsx                 shell: header, tab switching, bottom nav, initial load
  data/trip.js            itinerary days, legs/colors, defaults, budget constants
  lib/storage.js          IndexedDB persistence + backup/restore
  lib/image.js            outfit photo compression
  components/             shared UI (DayStrip, LegChip, SectionTitle, BackupControls)
  tabs/                   one file per tab
```
