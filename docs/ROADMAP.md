# Roundtrip roadmap: operator test

Owner: @director. Scope and reasons are in `docs/BUILD-PLAN.md`. Item numbers below refer to its build list.

Status key: `[ ]` not started, `[~]` in progress, `[x]` done and checked by @director.

## Already done before this roadmap

These work today and are not scheduled again: production deploy of app and landing, domains and DNS, Supabase prod and dev, anonymous auth with email OTP and Google linking, join codes, itinerary with weather and map, packing, budget with settle-up, bookings and documents wallet, AI itinerary suggestions, Sentry, weekly backups, CI, account deletion.

## Phase 0: Baseline (Fri 23 Oct)

Goal: everything committed on a working branch, a green build, and every agent agreed on the contracts. No feature work yet.

- [ ] **user:** commit or stash any uncommitted work of your own that isn't part of this setup, then open the agent tabs (see `docs/SETUP.md`).
- [ ] **user:** message the friend group: open the app once while online so offline changes sync, and outfit photos will be deleted on Sun 1 Nov, so export a backup from settings if they want them.
- [x] **director:** tag the current `main` as `pre-operator-build`, create the `operator-build` branch, commit the setup files (`CLAUDE.md`, `.claude/agents/`, `docs/ROADMAP.md`, `docs/PROMPTS.md`, `docs/SETUP.md`, `docs/BUILD-PLAN.md`, `docs/LAUNCH-EXPLAINED.md`) and push the branch.
- [x] **every agent:** read your owned paths and report their current state to @director in a few lines. (Orchestrated run: replaced by fixed contracts in `docs/ORCHESTRATE.md`.)
- [x] **data:** send @trip and @shell the role and session API names (BUILD-PLAN item 1).
- [x] **ai:** send @trip the planned `importItinerary()` signature and error codes.
- [x] **shell:** send @trip the `joinLink.js` helpers and where `JoinLinkGate` will mount.

How to check: `git log --oneline -3` on `operator-build` shows the setup commit with no Claude attribution, `git tag` lists `pre-operator-build`, `npm run check` passes, and each agent's report is noted below.

Agent reports (orchestrated run, 23 Oct; commits start `W<n> <agent>:`):
- data: W1 roles, session API, weather, RLS test, shiftTrip, metrics; W3 outfit data removed, 009 written.
- ai: W1 guard, try-on 410, import endpoint, tests, evals 5/5; W3 `tryon.js` deleted, evals 5/5.
- trip: W2 role gating, join links, Outfits removed, import, Run again, packing editor, trip-info card, lazy map.
- shell: W1 join gate, install hint, demo, OG, SW fallback, landing, README; W3 gradio dropped, screenshots, phone smoke test.

## Phase 1: Foundations (Sat 24 to Tue 27 Oct). Items 0 to 4

Goal: roles enforced in the database, join links working, Outfits gone from the UI, Budget hidden on organiser-only trips.

Order and dependencies:
1. [~] **data:** `008_roles.sql`, the session API, weather cache local-only, and the RLS test script. The user runs 008 on `roundtrip-dev`. Trip and shell build against the announced names in parallel, but can't fully test until 008 is on dev. Built; waiting on the user to run 008 on dev, then the RLS test.
2. [x] **shell:** `joinLink.js`, `JoinLinkGate.jsx`, Open Graph tags, service-worker fallback for `/j/*` and `/demo`, `InstallHint.jsx`. Remove the `OutfitsTab` import from `harness.jsx`. Widen the Vitest include for @ai.
3. [x] **trip:** role gating across tabs and settings, the "Members can edit" switch and co-organiser control, mount `JoinLinkGate`, `joinUrl()` in share text, remove Outfits (after shell's harness change), hide Budget when members can't edit. Not yet checked in two browsers against dev.
4. [x] **ai:** move the guard into `api/_lib/`, `api/tryon.js` returns 410, delete `src/lib/tryon.js` after trip removes Outfits.
5. [x] **data:** after trip's Outfits removal, take closet loading out of `storage.js` and `session.js`, and write `009_purge_outfits.sql` (not run yet).

How to check, on `npm run dev` against `roundtrip-dev` or the `operator-build` preview:
- As organiser in one browser: create a trip, turn "Members can edit" off, share it. The share text contains an `app.roundtrip.one/j/...` link.
- In a private window: open the link, enter a name, land on the itinerary with no onboarding screens. No edit controls on shared data, no Budget tab, no Outfits tab.
- data's RLS test script passes against dev: a member can't write shared rows or another member's personal rows on that trip.
- A trip with "Members can edit" on behaves as before for everyone.
- After an hour of use, the member's device shows no "Sync failed".
- `npm run check` passes.

## Phase 2: Operator features (Wed 28 to Sat 31 Oct). Items 5 to 10

Goal: an operator can paste their itinerary, run the trip again next weekend, and see a demo before trying anything.

Order and dependencies:
1. [x] **ai:** `api/itinerary-import.js`, `importItinerary()`, evals at 8 of 10 or better. Shell adds the dev route. Evals 10 of 10 (W4, 23 Oct).
2. [x] **data:** `shiftTrip.js` with tests, `duplicateTrip()`, `supabase/queries/operator-metrics.sql`.
3. [x] **trip:** paste-your-itinerary in the wizard (needs 1), Run again on trips home (needs 2), organiser packing list in settings. If time: pinned trip info (item 8), then lazy-load the map. Including item 8 and the lazy map.
4. [x] **shell:** the `/demo` trip, then the landing rewrite with real screenshots from it, then README and `LAUNCH-REMAINING.md` updates including the extended phone smoke test.
5. [x] **director:** Thu 29 Oct schedule check. If behind, drop item 8, then item 5. Nothing dropped; all items built by 23 Oct.

How to check:
- Paste a real itinerary from an operator's website into the wizard and get a trip with the right days and readable plans.
- Run a 3-day trip again for next weekend: same plan on the new dates, a new code, and only you as a member.
- `app.roundtrip.one/demo` on the preview opens with no sign-in, and the landing page shows real screenshots with "See a demo trip".
- ai's eval report shows at least 8 of 10 fixtures passing.
- `npm run check` passes.

## Phase 3: Freeze and go live (Sun 1 Nov)

Goal: production runs the new build.

1. [ ] **user:** run the backup workflow and confirm it's green.
2. [ ] **user:** run `008_roles.sql` on prod. **data** checks it with `AUDIT.sql`.
3. [ ] **user:** run `009_purge_outfits.sql` on prod and empty the `outfit-photos` bucket.
4. [ ] **user:** merge `operator-build` into `main`. This deploys the app and the landing site.
5. [ ] **user:** run the phone smoke test from `docs/LAUNCH-REMAINING.md` on iOS Safari and Android Chrome, including a join link sent through WhatsApp.
6. [ ] **director:** mark the freeze and write Phase 4 prompts.

How to check: a phone that has never opened the app joins a trip from a WhatsApp link, roundtrip.one shows the new landing page, and `AUDIT.sql` on prod matches its expectations.

## Phase 4: Outreach (Mon 2 to Sun 15 Nov)

Goal: at least 3 operators agree to run a real trip on Roundtrip.

- **user (with Grok):** message 20 to 30 small Delhi operators, track replies in the sheet described in BUILD-PLAN, and set up their first trips with them.
- **shell:** fix anything operators hit while joining or on the demo.
- **trip, ai, data:** fixes only, for problems operators report. Nothing from "Not in this build".
- **director:** route every report to its owner.

Kill check, Sun 15 Nov: [ ] at least 3 operators have agreed. Result: ______. If 0 or 1, stop feature work.

## Phase 5: Live trips (Mon 16 Nov to Mon 4 Jan)

Goal: operators run trips, including New Year departures, without needing you.

- Fixes and small requests from operators, routed by @director.
- If several operators ask for the same thing from "Not in this build" (likely expenses), plan it for January rather than starting it now.

## Phase 6: Decision (Sun 10 Jan)

- [ ] **user:** run `supabase/queries/operator-metrics.sql` on prod.
- [ ] **director:** compare with the kill criteria and record the result here.

Kill check, Sun 10 Jan: [ ] at least 2 operators ran 3 or more trips each, [ ] at least one of those trips created by the operator without you, [ ] at least half the travellers joined on those trips. Result: ______.

- Both pass: plan January from what operators asked for most.
- Either fails: stop, and write the case study described in BUILD-PLAN.

## Gaps found during setup

Not in BUILD-PLAN, but needed to ship. Each has an owner and a phase.

- [x] **CI doesn't run on `operator-build`.** `check.yml` runs only on pushes to `main` and on pull requests. **director**, Phase 0: open a draft pull request from `operator-build` to `main` so every push gets checked. Don't merge it before Sun 1 Nov. Draft PR #1.
- [ ] **Gemini key in Vercel.** The import endpoint needs `GEMINI_API_KEY` in both Production and Preview, and "AI itinerary suggestion works" is still unticked in `LAUNCH-REMAINING.md`. **user**, Phase 1: check both environments. **shell** adds any new env var names to `.env.example`.
- [x] **Privacy policy is out of date.** `landing/privacy.html` and `public/privacy.html` describe outfit photos, and don't mention pasted itineraries going to Gemini or organiser contact details on the trip-info card. **shell**, Phase 2.
- [x] **Join link with no signal.** Someone opening a `/j/` link offline can't join. `JoinLinkGate` needs a clear offline message and a retry, plus loading and bad-code states. **shell**, Phase 1.
- [~] **Accessibility on new screens.** Labels on the join name field, the "Members can edit" switch and the Run again date picker, and contrast in both themes. **trip** and **shell**, as part of verifying their own work. Labels done. Contrast computed from token values in both themes (W4): `--ink-faint` raised to pass 4.5:1; not yet measured on rendered pages.
- [x] **Supabase free-plan limits.** Inactive free projects get paused, and realtime connections are capped. **data**, Phase 1: note the current limits in `supabase/SETUP.md` so nobody is surprised during live trips.
- [ ] **Automated join-flow check (if time).** A `playwright-core` script that opens a `/j/` link in a fresh browser against dev and confirms it lands on the itinerary. **shell**, Phase 2.

## Waiting on user

Collected from the overnight W4 run (23 Oct). Nothing here blocks the build; each one blocks a check.

- [ ] Run `supabase/migrations/008_roles.sql` on `roundtrip-dev` (expect "Success. No rows returned.").
- [ ] Then run `supabase/migrations/010_keep_an_organiser.sql` on `roundtrip-dev` (needs 008 first; same expected result).
- [ ] Then run `node --env-file=.env.local supabase/tests/rls-roles.mjs --i-know-this-is-dev` (expect "All checks passed"), and `supabase/AUDIT.sql`: block 6 returns 0 rows, block 10 returns one trigger row.
- [ ] Check `GEMINI_API_KEY` is set in Vercel Production and Preview.
- [ ] Two-browser check on the `operator-build` preview: organiser and member, join link, "Members can edit" off and on, paste itinerary, Run again.
- [ ] Look at the new eval fixtures 09 and 10: 09 is a real itinerary rewritten as a WhatsApp message, and 10 was rebuilt from search results because the operator page returned 502. Swap in real operator text if you have it.
- [ ] Sun 1 Nov: backup, then 008, 010 and 009 on prod (009 also needs the `outfit-photos` bucket emptied and deleted in the dashboard), merge `operator-build` into `main`, phone smoke test from `docs/LAUNCH-REMAINING.md`.
