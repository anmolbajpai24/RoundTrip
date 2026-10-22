# Run sheet: one session builds everything

One Claude Code session works through the whole of `docs/BUILD-PLAN.md`, in the order below, on the `operator-build` branch. `BUILD-PLAN.md` has the full detail for each item; this file adds the order, the code pointers found during setup, and the rules for saving tokens and resuming.

## Rules

- **Resuming.** Run `git log --oneline -20`. Every finished step has a commit starting `Step N:`. Continue from the first step without one. Don't redo finished steps.
- **After every step:** run `npm run check`. If it passes, commit only that step's files with the message `Step N: <short summary>`, then `git push origin operator-build`, then reply with one line: what's done and the commit hash. Then go straight to the next step.
- **Saving tokens.**
  - Use Grep to find code and read only the line ranges you need. Don't re-read files you have already read in this session unless they changed.
  - Don't use subagents. Don't paste whole files into replies.
  - Keep replies to a line or two between steps.
- **Never:**
  - Push or merge to `main` (that deploys production).
  - Read, print or commit `.env.local`.
  - Add Co-Authored-By lines or any Claude attribution.
  - Run `supabase/schema.sql`.
- **SQL.** You can't run SQL. When a step needs it, write the migration file, tell the user exactly what to paste into the `roundtrip-dev` SQL editor and what they should see, then wait for them to confirm before testing against it. While waiting, carry on with parts that don't need the database.
- **Stopping.** If the user says the limit is close, finish and commit the current step, then stop.

## Steps

### Step 0: Branch
- Tag current `main` as `pre-operator-build`. Create and switch to `operator-build`.
- Commit `CLAUDE.md`, `docs/BUILD-PLAN.md`, `docs/RUN-ALL.md`, `docs/ROADMAP.md`, `docs/PROMPTS.md`, `docs/SETUP.md`, `docs/LAUNCH-EXPLAINED.md` and `docs/agents/`.
- Push the branch and the tag.
- If the `gh` CLI is installed and signed in, open a draft PR from `operator-build` to `main` so CI (`check.yml` only runs on `main` and PRs) checks every push. Otherwise skip that.

### Step 1: Roles (BUILD-PLAN item 1)
- Write `supabase/migrations/008_roles.sql` from the sketch in BUILD-PLAN. Also restrict `trip-docs` storage insert and delete with `can_edit_shared`, and update `supabase/AUDIT.sql` expectations.
- Session API in `src/lib/session.js`:
  - the role and `membersCanEdit` on the session, and members loaded with `role`
  - `canEditShared()`, `setMembersCanEdit()`, `setMemberRole()`
- `src/lib/weather.js:152` writes the shared `trip-weather` key from every device. Make the forecast cache local-only (IndexedDB, no `saveKey`).
- Find every `saveKey(` that writes a shared key, and gate each edit control on `canEditShared()`:
  - shared day notes in `ItineraryTab.jsx`
  - `BookingsTab.jsx`, including document upload and delete
  - `TripSettings.jsx`
  - Packing lists and a member's own notes stay editable.
- `TripSettings.jsx`, organisers only: a "Members can edit" switch and a member list with "Make co-organiser".
- RLS test script in `supabase/tests/`, run against `roundtrip-dev`. It must show:
  - a member on a members-can't-edit trip can't write shared rows or someone else's personal rows
  - an organiser can
- Ask the user to run 008 on dev, then run the test.

### Step 2: Join links (item 2)
- `src/lib/joinLink.js` exports `parseJoinPath()` and `joinUrl(code)`, which returns `https://app.roundtrip.one/j/CODE`.
- New `src/components/JoinLinkGate.jsx`, mounted in `App.jsx` before the Onboarding check:
  - skips onboarding and asks only for a name, prefilled from the profile when there is one
  - joins through `session.js`, lands on today's day (day 1 if the trip hasn't started), then replaces the URL with `/`
  - already a member: goes straight in
  - bad code: a plain message plus the type-a-code fallback
  - offline: a clear message and a retry
- Share text in `TripWizard.jsx` `share()`, and anywhere else a code is shared, uses `joinUrl()`.
- `index.html`: static Open Graph tags (title, description, image, URL).
- `vite.config.js`:
  - make the service worker's navigation fallback cover `/j/*` and `/demo`
  - drop outfits from the manifest description
- New `src/components/InstallHint.jsx`, rendered from `src/main.jsx`, shows the Add to Home Screen hint only from the second visit. Count visits in localStorage inside try/catch.

### Step 3: Cut Outfits (item 3)
- Remove `harness.jsx`'s `OutfitsTab` import first.
- Remove the Outfits entry from `TABS` and `TAB_IDS` in `App.jsx`. If the remembered tab in localStorage (`roundtrip:tab`) is `outfits`, fall back to the itinerary.
- Delete:
  - `src/tabs/OutfitsTab.jsx`
  - `src/components/OutfitGallery.jsx` and `src/components/OutfitImage.jsx` (with their CSS)
  - `src/lib/closet.js`, `src/lib/outfitPhotos.js`, `src/lib/tryon.js`
  - the closet import in `ItineraryTab.jsx`
- Keep `DayWeather.jsx` and `outfitAdvisor.js`.
- `api/tryon.js` returns 410 Gone. Remove its route from `vite.config.js`.
- Remove `loadClosetsAll` and outfit handling from `storage.js` and `session.js`, and delete `src/lib/__tests__/foldClosetRows.test.js`.
- Remove `@gradio/client` from `package.json` if nothing else uses it.
- Write `supabase/migrations/009_purge_outfits.sql`. It deletes the `outfit:*`, `outfit-item:*`, `outfit-days` and `tryon-base-photo` rows, plus a note on emptying the `outfit-photos` bucket. Don't ask the user to run it; it runs on prod on Sun 1 Nov.

### Step 4: Hide Budget (item 4)
- The Budget tab is hidden for everyone when the trip's `membersCanEdit` is false.

### Step 5: Paste your itinerary (item 6)
- Move the JWT check and daily cap out of `api/itinerary.js` into `api/_lib/`, with behaviour unchanged.
- New `api/itinerary-import.js`, exporting `runItineraryImport(body, authHeader)`:
  - input: `text` (capped around 6,000 characters), `startDate`, `endDate`
  - uses Gemini's JSON response schema to return `days: [{ date, city, plan }]` covering every date
  - clamps plan length like `MAX_PLAN` and repairs dates that fall outside the range
  - never logs the pasted text
- Add its route to `apiDevEndpoints` in `vite.config.js`.
- `importItinerary({ text, startDate, endDate })` in `src/lib/itinerary.js`, with the same return shape and error codes as `generateItinerary()`.
- In `TripWizard.jsx`, add a "Paste your itinerary" option next to the AI suggestion and manual entry. Reuse the existing city-to-legs code (around lines 148 to 173).
- Evals, trimmed to save tokens:
  - 5 fixtures in `evals/fixtures/`. Ask the user to paste real operator itineraries, or fetch at most 5 public operator trip pages.
  - `node evals/run-import.mjs` checks the day count, a city on every day, non-empty plans, and dates in range.
  - The target is 4 of 5.
  - Gitignore `evals/results/`.

### Step 6: Run again (item 7)
- New pure `src/lib/shiftTrip.js` with Vitest tests in `src/lib/__tests__/shiftTrip.test.js`. Find every date-keyed value first.
- `duplicateTrip(tripId, newStartISO)` in `session.js` creates a trip with a fresh code. It copies:
  - `trip-config` with dates shifted, including `packingTemplate`
  - `trip-itinerary`, re-keyed to the new dates
  - `trip-bookings`, with done flags reset
- It copies nothing personal, and no members, expenses or documents.
- `TripsHome.jsx`: trips I organise get "Run again", then a date picker, then `duplicateTrip()`, then into the new trip.

### Step 7: Demo (item 9)
- New `src/data/demo/kasolWeekend.js`:
  - 3 days: Delhi pickup, Kasol, Tosh, Chalal
  - members can't edit
  - includes a packing template and a couple of bookings
- New `src/demo/`, rendered read-only at `/demo` from `src/main.jsx`. Base it on the `harness.jsx` approach.
  - lazy-loaded, with no Supabase calls
  - a banner linking to "Start your own trip"

### Step 8: Landing and launch docs (item 10)
- Rewrite `landing/index.html` and `landing/style.css` for organisers:
  - the share link, itinerary, packing list, and running a trip again
  - "See a demo trip" linking to `https://app.roundtrip.one/demo`
  - keep "No account needed"
- Screenshots of the demo with `playwright-core` into `landing/shots/`.
- `landing/privacy.html` and `public/privacy.html`:
  - remove outfit photos
  - add that pasted itineraries are processed by Gemini
- `README.md`: remove try-on and outfits, and add join links and the demo.
- `docs/LAUNCH-REMAINING.md`: extend the phone smoke test with the item 10 checks, including:
  - which browser WhatsApp opens links in
  - whether reopening a trip creates a duplicate member

### Step 9: Organiser packing list (item 5), only if the limit allows
- In `TripSettings.jsx`, organisers edit `packingTemplate` (categories and items). Members' lists are already seeded from it at `App.jsx:32`.
- Add a line saying members get the list when they join.

### Step 10: Pinned trip info (item 8), only if the limit allows
- New `trip-config` fields: pickup point with an optional maps link, pickup time, trip lead name and phone (`tel:` link), and emergency contact.
- Shown at the top of `ItineraryTab.jsx`. Organisers edit them in settings.

## When all steps are done

Reply with a short summary:
- the commit hash for each step
- anything skipped
- the main JS chunk size from `npm run build`
- the eval score
- what the user still has to do for Sun 1 Nov (Phase 3 in `docs/ROADMAP.md`): backup, 008 and 009 on prod, merge to `main`, phone smoke test
