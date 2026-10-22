# Orchestrated run: the director executes the whole plan

The director runs the data, ai, shell and trip agents as **subagents** in four waves, from one Claude Code tab. You paste one prompt; it does every item in `docs/BUILD-PLAN.md`. Each subagent has its own context, so no agent loads another's files, and the director only keeps short reports.

Fallback: if subagents misbehave, `docs/RUN-ALL.md` does the same work in one session.

## Director rules

- **Resuming.** Run `git log --oneline -30`. Every finished wave leaves commits starting `W<n> <agent>:`. Continue from the first wave or agent without one.
- **Launching subagents.** Use the subagent type with the agent's name (`data`, `ai`, `shell`, `trip`) when it exists. Otherwise use a general-purpose subagent and start its prompt with "Read docs/agents/<name>.md and act as that agent." Launch the agents in a wave together in one message so they run in parallel.
- **Every subagent prompt** is: the agent's task list for that wave (below), the fixed contracts (below), and the subagent rules (below), copied in full.
- **Commits.** Subagents never commit. After each wave:
  - run `npm run check`; if it fails, send the failure back to the agent that owns the failing file and re-run
  - commit each agent's files separately, staging only that agent's paths from the ownership map in `CLAUDE.md`, with the message `W<n> <agent>: <summary>`
  - then `git push origin operator-build`
- **Never:**
  - Push or merge to `main`.
  - Add Co-Authored-By lines or any Claude attribution.
  - Read, print or commit `.env.local`.
- **Talking to the user.** Keep replies to one line per wave, except when you need them to run SQL or answer a subagent's question.
- **Stopping.** If the user says the limit is close, let the running subagents finish, commit what passes `npm run check`, then stop.

## Subagent rules (paste into every subagent prompt)

```
You are running as a subagent of the director. Rules for this run:
- Edit only your owned paths from CLAUDE.md. Don't commit, don't push, don't message other agents.
- The contracts below are fixed. Build to them exactly. If one can't work, say so in your report instead of changing it.
- Save tokens: use Grep to find code, read only the line ranges you need, don't re-read files, don't launch subagents, don't paste whole files into your report.
- You can't run SQL. Write migration files and put exact instructions for the user in your report.
- Before returning, run npm run check. If it fails because of your files, fix them. If it fails because of another agent's area, say which file.
- Return a report under 200 words: what you built, files changed, what you tested and how, anything untested, anything you need from another agent, and any question for the user.
```

## Fixed contracts

**`src/lib/session.js` (data)**
- `getSession()` gains `role` (`"organiser"` or `"member"`) and `membersCanEdit` (boolean).
- `loadMembers()` rows gain `role`.
- `canEditShared()` is synchronous and returns `true` for an organiser, or for anyone when `membersCanEdit` is true. It returns `false` when there is no session; the read-only demo relies on that.
- `setMembersCanEdit(value)` and `setMemberRole(userId, role)` are async and organiser-only. They throw on failure.
- `duplicateTrip(tripId, newStartISO)` is async and returns the new session, the same shape `createTrip()` returns.
- Role and `membersCanEdit` changes reach other members' open apps without a reinstall, by refreshing on realtime or on app focus.
- The join function stays `joinTrip(code, name, color)`.

**`src/lib/itinerary.js` (ai)**
- `importItinerary({ text, startDate, endDate })` returns `[{ date, city, plan }]` for every date in range.
- On failure it throws an `Error` whose `.code` is one of `quota`, `busy`, `unavailable`, `unauthorized`, `disabled`, `bad-input`.
- It also exports `itineraryImportAvailable` (boolean).

**`src/lib/joinLink.js` and `src/components/JoinLinkGate.jsx` (shell)**
- `parseJoinPath(pathname)` returns the upper-case code for `/j/CODE`, or `null`.
- `joinUrl(code)` returns `https://app.roundtrip.one/j/CODE`.
- `<JoinLinkGate code={code} onReady={fn} />` calls `onReady()` once the session is set, exactly like `TripGate`'s `onReady`.
- Trip mounts it in `App.jsx` before the Onboarding check whenever `parseJoinPath(location.pathname)` returns a code.

## Waves

### Wave 0: director alone
1. If `.claude/agents/` doesn't have the five role files, copy them there from `docs/agents/`. If writing to `.claude/` is refused, carry on with general-purpose subagents as described above.
2. Tag current `main` as `pre-operator-build`, create and switch to `operator-build`, and commit:
   - `CLAUDE.md`
   - `docs/BUILD-PLAN.md`, `ORCHESTRATE.md`, `RUN-ALL.md`, `ROADMAP.md`, `PROMPTS.md`, `SETUP.md`, `LAUNCH-EXPLAINED.md`
   - `docs/agents/`
   - `.claude/agents/`, if it now exists
   
   Use the message `W0 director: agent setup and plan`.
3. Push the branch and the tag.
4. If `gh` is installed and signed in, open a draft PR from `operator-build` to `main` so CI checks every push.

### Wave 1: data, ai and shell in parallel

**data** (role file items 2, 3, 4, 5, 6, 8):
- `supabase/migrations/008_roles.sql`, with `AUDIT.sql` expectations updated.
- The session API per the contract, including propagation.
- Weather cache local-only.
- RLS test script in `supabase/tests/`, written but not yet run.
- `shiftTrip.js` with tests, and `duplicateTrip()`.
- `supabase/queries/operator-metrics.sql`.
- A note on Supabase free-plan limits in `supabase/SETUP.md`.
- Not the outfits cleanup; that's wave 3.

**ai** (role file items 1 to 5, except deleting `src/lib/tryon.js`):
- The guard moved into `api/_lib/`.
- `api/tryon.js` returns 410.
- `api/itinerary-import.js`, plus `importItinerary()` and `itineraryImportAvailable` per the contract.
- Unit tests in `api/__tests__/`.
- Evals with 5 fixtures (target 4 of 5). Ask the user for itineraries in your report, or fetch at most 5 public operator trip pages.

**shell** (role file items 2 to 6, plus the landing copy):
- `joinLink.js` and `JoinLinkGate.jsx` per the contract, with loading, bad-code and offline states.
- Open Graph tags.
- Service-worker navigation fallback for `/j/*` and `/demo`, and outfits removed from the manifest description.
- `InstallHint.jsx`.
- In `vite.config.js`: add the `/api/itinerary-import` dev route and remove the `/api/tryon` route.
- Widen the Vitest include to `api/**/*.test.js`, and gitignore `evals/results/`.
- Remove the `OutfitsTab` import from `harness.jsx`.
- The read-only `/demo` from `src/data/demo/kasolWeekend.js`.
- Rewrite `landing/index.html` and `style.css` for organisers.
- Update `landing/privacy.html` and `public/privacy.html`: remove outfit photos, and add that pasted itineraries are processed by Gemini.
- Update `README.md`.

**After wave 1 (director):**
- Check and commit as in the director rules.
- Give the user data's exact instructions for running `008_roles.sql` on `roundtrip-dev`, and any itinerary request from ai.
- Don't wait for the SQL; start wave 2.

### Wave 2: trip, in two parts run one after the other

**trip, part A:**
- Role gating on every shared-data edit control, using `canEditShared()`.
- The "Members can edit" switch and "Make co-organiser" in `TripSettings.jsx`.
- Mount `JoinLinkGate` and use `joinUrl()` everywhere a code is shared.
- Remove Outfits completely, including the stored-tab fallback and the closet import in `ItineraryTab.jsx`. Keep `DayWeather.jsx` and `outfitAdvisor.js`.
- Hide Budget when `membersCanEdit` is false.

The director commits part A before starting part B.

**trip, part B:**
- "Paste your itinerary" in the wizard using `importItinerary()`, reusing the city-to-legs code around lines 148 to 173.
- "Run again" on `TripsHome.jsx` using `duplicateTrip()`.
- The organiser packing list editor in `TripSettings.jsx`.
- If there's room: the pinned trip-info card, then lazy-loading `TripMap.jsx`.

**After wave 2 (director):** check and commit.

### Wave 3: data, ai and shell in parallel

**data:**
- Remove `loadClosetsAll` and outfit handling from `storage.js` and `session.js`, and delete `foldClosetRows.test.js`.
- Write `009_purge_outfits.sql` (not run until Sun 1 Nov).
- If the user has confirmed 008 is on dev, run the RLS test against dev and report the result.

**ai:**
- Delete `src/lib/tryon.js`.
- Run the evals and report the score.

**shell:**
- Remove `@gradio/client` from `package.json` if nothing uses it.
- Capture screenshots of `/demo` with `playwright-core` into `landing/shots/` and put them in the landing page.
- Update `docs/LAUNCH-REMAINING.md` with the extended phone smoke test from BUILD-PLAN item 10.
- Report the main JS chunk size from `npm run build`.

**After wave 3 (director):**
- Check, commit and push.
- Tick off finished items in `docs/ROADMAP.md` in one edit.
- Reply to the user with:
  - the commits per wave
  - anything skipped
  - the RLS test result
  - the eval score
  - the chunk size
  - their Sun 1 Nov list: backup, 008 and 009 on prod, merge `operator-build` into `main`, phone smoke test
