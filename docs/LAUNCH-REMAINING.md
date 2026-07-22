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

## 4. Landing screenshots

- [ ] Make a demo trip that looks good (real-ish itinerary, a few packing
      items ticked, outfits with photos).
- [ ] Capture phone-viewport screenshots of the itinerary, packing, and
      outfits tabs → save as `landing/shots/itinerary.png`, `packing.png`,
      `outfits.png`. (Or ask Claude in the repo to capture them via
      Playwright once the demo trip exists.)
- [ ] In `landing/index.html`, swap each
      `<div class="coming">…</div>` for
      `<img src="/shots/<name>.png" alt="<tab> tab" />` — the comment above
      the block shows exactly this. Commit + push deploys it.

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
- [ ] When all boxes are ticked: delete this file.
