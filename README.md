# Roundtrip

A trip planner for groups. One person creates a trip, shares a six-letter
code, and everyone on it sees the same itinerary, budget, bookings and
documents, syncing in near real-time. Installs to the home screen and works
offline.

Live at [roundtrip.one](https://roundtrip.one) (landing) and
[app.roundtrip.one](https://app.roundtrip.one) (the app). No account needed
to start.

<!-- SCREENSHOT: the trip itinerary view on mobile, with the day list and
     weather strip visible. Use a real trip with real destinations, not
     placeholder data. Full width, right here. -->

## Why I built it

I was planning a 24-day trip with a group and we were running it across a
spreadsheet, three chat threads and a folder of screenshots. Nobody knew
which version of the plan was current. So I built this, and then used it
every day of that trip. Most of the design decisions came from things that
annoyed us while we were actually travelling: the packing list needed to be
per person but the budget needed to be shared, notes needed to work with no
signal, and nobody wanted to make an account before they could see anything.

## What's in it

Itinerary with per-day weather and outfit advice, a trip map, outfit planner
with photos, packing lists, shared budget with settle-up, a booking
checklist, and a documents wallet for tickets and PDFs. Light and dark
themes. Backup and restore of a whole trip as JSON.

### The AI parts

**Itinerary planner.** In the trip wizard, generates a starting plan for the
destinations and dates you picked. Runs on Gemini.

**Virtual try-on.** Upload one photo of yourself, private, and any outfit in
the closet can be rendered on you. Defaults to the public IDM-VTON
HuggingFace Space, which is free and takes 30 to 90 seconds. Setting
`GEMINI_API_KEY` switches it to Gemini 2.5 Flash Image, roughly four cents an
image with no daily cap. Results are cached per outfit, so nothing
regenerates unless you ask.

Both run server-side in `api/tryon.js`, a Vercel function also mounted on the
dev server, so engine keys never reach the browser.

<!-- GIF: the try-on flow. Pick an outfit, hit "See it on me", show the
     result. Cut the wait, nobody needs to watch 60 seconds of spinner. -->

## Stack

Vite and React (CSS Modules with design tokens) on Supabase. Anonymous-first
auth: everything works as a guest in one browser, and linking an email or
Google account carries the same identity onto other devices.

ESLint and Vitest, Sentry for errors, GitHub Actions for CI and for versioned
`pg_dump` backups.

## Develop

```bash
npm install
npm run dev
```

## Backend setup (one-time)

The app uses a free Supabase project for sync and auth. Follow
`supabase/SETUP.md`: create the project, run `supabase/schema.sql` once and
never again because it drops the tables, then run
`supabase/migrations/001_public_hardening.sql` and
`002_documents_storage.sql`, both additive and live-safe. Enable the auth
providers, and put your project URL and anon key in `.env.local`.

### Optional keys, all with free tiers

| Variable | What it turns on |
|---|---|
| `VITE_UNSPLASH_ACCESS_KEY` | Real destination photos on trip cards instead of gradients |
| `HF_TOKEN` | Your own free ZeroGPU quota for try-on, roughly 7 to 14 a day |
| `GEMINI_API_KEY` | Faster, better try-on, and the itinerary planner |

If the IDM-VTON Space moves or breaks, point `HF_TRYON_SPACE` at another one
with the same `/tryon` API.

## Deploy

Two Vercel projects off this one repo, the app at the root and the landing
site rooted at `landing/`, both auto-deployed from `main`. The full go-live
checklist, DNS through to backups, is in `docs/LAUNCH.md`.

## How trips work

Create a trip: name, dates, currency (plus an optional second display
currency and budget), then search and add destinations. Each day is assigned
to a destination automatically and can be edited after. Share the trip code
so others can join. Everyone sees the whole trip, with each person's
additions labelled.

## Where the data lives

Everything is stored in Supabase and mirrored to IndexedDB on each device as
an offline cache with a write outbox.

- **Shared by all members:** the trip definition (days, destinations, money
  settings, cover photo), shared day notes, expenses with who-paid and
  settle-up, bookings, and the document list. The files themselves live in a
  private, member-only Supabase Storage bucket.
- **Personal per member:** packing list, outfit photos, own per-day notes.
- **Profile** (display name and colour) lives in auth user metadata and
  follows your account across trips and devices.

## Structure

```
src/
  App.jsx             shell: routing (gate -> trips home -> trip), header, tabs
  lib/tripConfig.js   per-trip config context + date/money helpers
  lib/session.js      trip create/join/enter, members, trips list
  lib/auth.js         account linking + sign-in (email OTP, Google)
  lib/storage.js      Supabase kv + IndexedDB cache + backup/restore
  lib/weather.js      Open-Meteo forecast, cached and synced
  lib/documents.js    documents wallet (Supabase Storage)
  components/         shared UI (wizard, settings, trips home)
  tabs/               one file per tab
api/tryon.js          server-side try-on, holds the engine keys
supabase/             schema.sql (do not re-run) + additive migrations
landing/              the marketing site at roundtrip.one
```

Everything network-related lives in `src/lib/supabase.js`, `session.js`,
`auth.js` and `storage.js`, so swapping the backend touches four files.

Built and maintained by me, [Anmol Bajpai](https://github.com/anmolbajpai24).
