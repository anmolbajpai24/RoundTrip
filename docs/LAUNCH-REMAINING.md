# Launch — what's left

Everything else from `LAUNCH.md` is done and verified (domains live, DNS,
Supabase prod URLs + OAuth, Resend, ImprovMX, UptimeRobot, Sentry project
created, roundtrip-dev schema + auth toggles, og.png). This file is only the
open items — all of them involve secrets or your phone, which is why they're
yours. Work top to bottom; each block says how to verify it.

## 1. Sentry — ✅ DONE (verified 22 Jul)

Env vars are in the deployed build; a scripted browser threw
"sentry smoke test — launch verification" on the live app and Sentry's ingest
accepted the events (3× HTTP 200). Check the issue in Sentry shows source
lines (not minified gibberish) — if it's minified, `SENTRY_AUTH_TOKEN` wasn't
present at build time; re-check it and redeploy.

## 2. Dev environment wiring (`roundtrip-dev`, ref `mkxqrgnnfjobwukoztcg`)

✅ ALL DONE (verified 22 Jul): `.env.local` (scripted end-to-end pass against
dev: anonymous sign-in → create_trip_with_code → kv write/read → delete_trip);
Vercel scoping (Preview = dev values, Production = prod, checked in the live
bundle); Google provider on dev (authorize endpoint 302s to Google with the
dev callback).

## 3. Backups — ✅ working (verified 22 Jul, run 29912291376: 894 KB dump)

After three fixes (session-pooler string + password reset by you; pipefail +
versioned pg_dump 17 binary in the workflow), the run is genuinely green and
weekly Monday backups are live. One optional proof step left:

- [ ] Once: download the artifact, un-gzip, paste into roundtrip-dev's SQL
      Editor and run, then check dev's Table Editor shows prod's trips
      ("already exists" notices are fine — the proof is the data arriving).

## 4. Landing screenshots — ✅ DONE (retaken 23 Oct)

Captured from the read-only `/demo` trip with `playwright-core` and the system
Chrome (390×780 phone viewport): `landing/shots/itinerary.png`, `packing.png`,
`bookings.png`, already in `landing/index.html`. The demo shows a member's
view, so there are no edit controls in them. To retake after a UI change:
`npm run build`, `npx vite preview`, then screenshot `/demo` and the Pack and
Book tabs at the same viewport.

## 5. Cutover

- [ ] Message the friend group: open the app once while online (flushes
      offline outboxes), then it's a one-time re-login + PWA reinstall at
      **app.roundtrip.one**.
- [ ] Phone smoke test at app.roundtrip.one:
      - [ ] email OTP arrives from `login@roundtrip.one`
      - [ ] Google sign-in round-trips back into the app
      - [ ] PWA installs (iOS Safari + Android Chrome)
      - [ ] AI itinerary suggestion works
      - [ ] delete a **throwaway** account: user + data gone; a shared trip
            with another member survives
      - [ ] old `round-trip-mauve.vercel.app` URL redirects
- [ ] Join links and roles (operator build). Use two phones that have never
      opened the app, one iPhone and one Android:
      - [ ] create a trip on phone A, share the link to WhatsApp; the preview
            unfurls with title, text and image
      - [ ] iOS Safari: tap the link on phone B → name only → itinerary, in
            under 20 seconds, no onboarding screens; URL ends up as `/`
      - [ ] Android Chrome: the same
      - [ ] a bad code (`/j/ZZZZZZ`) shows a plain message and the type-a-code
            fallback
      - [ ] opening the link again on a phone that already joined goes straight
            into the trip
      - [ ] members-can't-edit trip (the default): the member sees no pencil,
            no shared-note Add/Edit, no packing-template editor, no booking
            ticks or add box, and Budget is hidden; their own packing list and
            own notes still work
      - [ ] organiser turns on "members can edit": the member's open app picks
            it up (on focus or within a few seconds) without a reinstall, and
            turning it off takes the controls away again
      - [ ] `/demo` loads in under 3 seconds on mobile data with no sign-in
- [ ] Which browser WhatsApp opens links in. On each platform, note whether
      tapping the link opens the system browser (Safari / Chrome) or
      WhatsApp's in-app browser:
      - [ ] iOS: ______  Android: ______
      - [ ] If it's an in-app browser with its own storage: join there, then
            later open app.roundtrip.one in Safari / Chrome (or the installed
            PWA) and open the trip again. Check the organiser's member list for
            a second member with the same name. If there is one, tell @data
            and @shell: it needs handling (for example a "you're already on
            this trip" sign-in step) before outreach on Mon 2 Nov.
- [ ] When all boxes are ticked: delete this file.
