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

Tested 22 Jul: `.env.local` ✅ (scripted end-to-end pass: anonymous sign-in →
create_trip_with_code → kv write/read → delete_trip, all against dev). Vercel
scoping ✅ (dev entries were Development-only; Preview-scoped dev values added
via CLI — Production keeps prod values, verified in the live bundle). Still
open:

- [ ] **Google sign-in in dev** — the dev authorize endpoint still returns
      "provider is not enabled". In Supabase **roundtrip-dev** → Authentication
      → Providers → Google: paste the "RoundTrip" client ID + secret (GCP
      project `alien-dialect-468618-r2`), toggle ON, **Save**. Also confirm the
      Google client's redirect URIs include
      `https://mkxqrgnnfjobwukoztcg.supabase.co/auth/v1/callback`.

**Verify:** `https://mkxqrgnnfjobwukoztcg.supabase.co/auth/v1/authorize?provider=google`
in a browser should bounce to a Google sign-in page, not a JSON error.

## 3. Backups — ❌ first run FAILED, needs redo

The 22 Jul run produced a 20-byte empty dump: the secret used the **direct**
`db.…supabase.co` host (unreachable from GitHub) and the DB password's special
characters (`#`, `*`…) weren't URL-encoded, so pg_dump couldn't parse the
string. The workflow now fails loudly on this instead of going green. Redo:

- [ ] Supabase roundtrip-**prod** → Project Settings → Database → **Reset
      database password**, choose one with letters+digits only (kills both the
      encoding problem and the partial leak of the old password into the run
      log — private repo, but still).
- [ ] Prod dashboard → **Connect** (top bar) → **Session pooler** tab → copy
      that URI (host `…pooler.supabase.com`, port **5432**, user
      `postgres.tqzzpmpfhwujazjajogb`) and substitute the new password.
- [ ] GitHub repo → Settings → Secrets and variables → Actions → edit
      `SUPABASE_DB_URL` → paste the full string.
- [ ] Actions → "Database backup" → Run workflow. Green now genuinely means
      success; the log prints the dump size (expect tens of KB+, not 20 bytes).
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
