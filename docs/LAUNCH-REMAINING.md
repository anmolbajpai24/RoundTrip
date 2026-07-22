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

- [ ] **Google sign-in in dev:** Google Cloud project `alien-dialect-468618-r2`
      → the "RoundTrip" OAuth client → add redirect URI
      `https://mkxqrgnnfjobwukoztcg.supabase.co/auth/v1/callback`.
      Then Supabase roundtrip-dev → Authentication → Providers → Google:
      paste client ID + secret, toggle ON.
- [ ] **`.env.local`** (repo root — dev only, never committed):
      ```
      VITE_SUPABASE_URL=https://mkxqrgnnfjobwukoztcg.supabase.co
      VITE_SUPABASE_ANON_KEY=<roundtrip-dev anon key — Settings → API Keys → Legacy tab>
      ```
- [ ] **Vercel env scoping** (app project): make `VITE_SUPABASE_URL` and
      `VITE_SUPABASE_ANON_KEY` Production-only (prod values), then add a second
      entry of each scoped **Preview + Development** with the dev values.

**Verify:** `npm run dev` → create a throwaway trip → it appears in
roundtrip-dev's Table Editor (`trips`), not in prod. Then push any branch and
check the preview URL's network tab hits `mkxqrgnnfjobwukoztcg.supabase.co`.

## 3. Backups

- [ ] GitHub repo → Settings → Secrets and variables → Actions → New secret:
      `SUPABASE_DB_URL` = roundtrip-**prod** → Connect → **Session pooler**
      string (port 5432) with the DB password filled in.
- [ ] Actions tab → "Database backup" → Run workflow → wait for green.
- [ ] Download the artifact and restore it into roundtrip-dev once to prove
      it's restorable:
      `gunzip -c roundtrip-*.sql.gz | psql "<dev session-pooler string>"`
      (restoring into dev may spew "already exists" notices — fine; the point
      is that trip rows arrive).

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
