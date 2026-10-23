# How Roundtrip went to production — what we did, how, and why

A companion to `LAUNCH.md` (the checklist) and `LAUNCH-REMAINING.md` (the
tail end). This is the record of *why* each step existed and how it was
actually done, written so future-you can re-derive any of it.

The starting point: a working PWA at `round-trip-mauve.vercel.app`, deployed
by hand from one laptop (`vercel --prod`), used by one friend group, developing
directly against the production database. The goal: the same app at
**app.roundtrip.one**, a landing page at **roundtrip.one**, and the gap
between "side project" and "thing strangers can trust" closed.

---

## 1. Two Vercel projects, one repo

**What:** the existing Vercel project kept the app and gained the domain
`app.roundtrip.one`; a second project (`roundtrip-landing`) was created from
the same GitHub repo with Root Directory `landing/`, holding `roundtrip.one`
and `www.roundtrip.one`.

**Why two projects instead of routing by path:** the app is a PWA with a
service worker scoped to `/`. Serving a landing page from the same origin
means the service worker fights it — cached app shells bleed into the landing
page and vice versa. A subdomain is a different origin, so the service worker
scope stays clean. It also let the landing page be what it wants to be: plain
static HTML with no React bundle, no Supabase client, aggressive caching, and
its own `vercel.json` (`cleanUrls` so `/privacy` works without `.html`).

**Why the same repo:** the landing page reuses the app's design tokens
(colours, fonts from `src/styles/tokens.css`, copied not imported) and it's
one less repo to forget about. Vercel's Root Directory setting makes one repo
→ two deployments trivial.

## 2. DNS at GoDaddy

**What:** deleted GoDaddy's default "Parked" A record, then added the records
Vercel prescribed: `A @ → 216.198.79.1` (apex → landing), `CNAME app` and
`CNAME www` → per-project `vercel-dns-017.com` hosts, plus three `TXT _vercel`
ownership-verification records.

**Why this shape:** DNS apex records can't be CNAMEs (protocol rule), so the
apex gets Vercel's static IP while subdomains get CNAMEs. The TXT records
proved domain ownership because the domain had previously been claimed under a
different Vercel account. One snag: a leftover GoDaddy "Website Builder"
connection held a lock on `app` records with no disconnect button — removing
the forwarding freed it.

**Why Vercel-first, GoDaddy-second:** adding the domain in Vercel *generates*
the exact record values; typing records into GoDaddy from memory is how you
get subtle breakage.

## 3. The old-origin redirect

**What:** a host-conditioned 308 redirect in `vercel.json` sends anything
arriving at `round-trip-mauve.vercel.app` to `https://app.roundtrip.one`.

**Why:** the friend group's bookmarks, installed PWAs and shared join-links
all pointed at the old URL. Without a redirect the user base silently forks
across two origins — two sets of sessions, two IndexedDB caches, endless
"it works on my phone" confusion. 308 (permanent, method-preserving) tells
browsers and crawlers the move is forever.

**The cost we accepted:** origins don't share storage, so everyone re-logs-in
once and reinstalls the PWA. Data was safe because Supabase is the source of
truth — IndexedDB is only a cache plus an offline write outbox, which is why
the cutover instruction says "open the app online once first" (flushes any
queued offline writes before the origin dies).

## 4. Supabase production config

**What:** Site URL → `https://app.roundtrip.one`; redirect allowlist gained
`https://app.roundtrip.one/**`; the Google OAuth client (GCP project
`alien-dialect-468618-r2`) gained the new origin; the `service_role` key went
into Vercel as `SUPABASE_SERVICE_ROLE_KEY`.

**Why:** OAuth is a chain of "who's allowed to send users where". Supabase
only redirects back to allowlisted URLs; Google only accepts requests from
registered origins. Any link missing the new domain = login breaks only in
production, the worst place to discover it. The service_role key exists for
exactly one endpoint — account deletion — because deleting *another layer's*
data (auth users, other rows, storage objects) is precisely what row-level
security is designed to prevent. It's server-only: a `VITE_`-prefixed version
would be inlined into the public bundle, which would be a total compromise.

## 5. Custom auth email (Resend)

**What:** Resend account, domain `roundtrip.one` verified via DKIM/SPF records
in GoDaddy, SMTP credentials plugged into Supabase Auth, sender
`login@roundtrip.one`.

**Why it was necessary and not cosmetic:** Supabase's built-in email sender is
capped at a few emails **per hour, total, across all users**, and sends from
`supabase.co`. The app's sign-in is OTP-code-based — email delivery IS login.
The first day two strangers sign up in the same hour, the second one's code
silently never arrives. DKIM/SPF are the DNS records that let receiving mail
servers verify the mail genuinely comes from your domain — without them,
Gmail sends OTPs to spam.

## 6. Support email (ImprovMX)

**What:** free ImprovMX forwarding, catch-all `*@roundtrip.one` → Gmail, via
two MX records + one SPF TXT at GoDaddy.

**Why:** the privacy policy, ToS, landing footer and app all promise a contact
address; GDPR requests need somewhere to land. GoDaddy no longer bundles free
forwarding, and a paid mailbox is overkill for receiving. The records coexist
with Resend's because Resend's SPF lives on the `send` subdomain — only one
SPF record is allowed *per hostname*, not per domain.

## 7. Landing page + legal pages

**What:** `landing/` — static hand-written HTML/CSS in the app's Grand Tour
look: hero ("Start a trip" → the app), feature cards for the five tabs,
offline/install section, screenshot placeholders, a real 1200×630 `og.png`,
SEO/OG meta, and `privacy.html` + `terms.html`.

**Why a landing page at all:** the app requires interaction before it shows
value; a landing page is the thing you can link, share, and have indexed. The
CTA goes straight to the app because sign-up is anonymous-first — "Start a
trip" is genuinely zero-friction, which is the app's strongest pitch.

**Why the legal pages are real, not boilerplate:** the app stores names,
emails, trip locations and dates, travel documents, and photos of real people
— personal data under GDPR regardless of where the operator lives. The
privacy policy was drafted from what the app *actually does* (which
third-parties see what: Supabase, Vercel, Resend, Google/Gemini, Sentry,
Open-Meteo, Unsplash, OSM) so it's honest rather than protective-sounding.
The ToS adds the practical shields: no warranty, travel info may be wrong,
fair-use limits on AI, we may suspend abuse.

## 8. Account deletion

**What:** `api/account-delete.js` — verifies the caller's JWT, then with the
service_role key deletes their personal kv rows, any leftover outfit photos from before
the Outfits tab was removed, their
memberships, trips where they're the *sole* member (including storage), and
finally the auth user. In the UI: "Delete my account…" behind a
type-DELETE-to-confirm dialog.

**Why:** there was no deletion path at all, which is both a GDPR
right-to-erasure problem and a trust problem ("no way to delete my data" reads
terribly). The sole-member rule protects other people: a shared trip isn't
yours alone to destroy, so shared trips survive and only the leaver's slice
goes — and the privacy policy says exactly that.

## 9. Sentry + analytics + uptime

**What:** `@sentry/react` in the app (production-only, errors-only, an error
boundary at the root), `captureException` in the three API functions, source
maps uploaded at build (then deleted from `dist/` so they're never served);
Vercel Web Analytics on both projects; UptimeRobot pinging both domains.

**Why:** with friends, "it broke" arrives by text. With strangers it arrives
as silence — they just leave. Sentry turns unknown breakage on devices you
don't own (iOS Safari especially, where PWA bugs live) into stack traces.
Source maps matter because a minified trace (`t is not a function at a.js:1`)
is unactionable. Analytics is cookieless on purpose: no consent banner needed,
and sign-up counts still come from Supabase. Uptime monitoring covers the case
where the whole site is down and no error can even be sent.

**How it was verified:** a headless browser threw a deliberate error on the
live app and the Sentry ingest endpoint answered 200 — proof of the whole
pipeline, not just the config.

## 10. Dev/prod separation

**What:** a second free Supabase project (`roundtrip-dev`), schema + all seven
migrations applied, same auth toggles; `.env.local` points at it. In Vercel,
`VITE_SUPABASE_URL`/`ANON_KEY` exist twice: Production-scoped (prod values)
and Preview+Development-scoped (dev values).

**Why:** until then, every `npm run dev` session ran against real user data —
one mistyped migration or debugging session away from damaging production.
The env scoping matters because Vite inlines env vars *at build time*: each
Vercel build bakes in whichever values its environment scope provides, so
branch previews physically cannot touch prod.

**What testing caught:** the dev entries had been scoped Development-only, so
previews would have built with *no* backend at all; fixed by adding
Preview-scoped dev values via the CLI. Verified by running the app's real flow
(anonymous sign-in → create-trip RPC → kv write/read → delete) against dev
from a script, and by grepping the deployed production bundle for the prod URL.

## 11. Backups

**What:** a GitHub Actions cron (Mondays 03:00 UTC) that runs `pg_dump`
against prod via the session pooler and uploads a gzipped SQL artifact with
90-day retention (~13 rolling restore points).

**Why:** free-tier Supabase keeps **no** backups. Every trip existed in
exactly one place, one bad SQL statement from oblivion. Storage files
(documents, photos) are knowingly excluded — users can re-upload a ticket
PDF; nobody can retype a trip.

**The instructive failure chain (three broken runs before the first good one):**
1. *Green run, 20-byte artifact.* The secret used the direct `db.…` host and
   an un-encoded password with `#`/`*` in it — pg_dump failed, but in a shell
   pipeline `pg_dump | gzip`, the exit code comes from `gzip`, so the job
   passed. Fix: `set -o pipefail` + a minimum-size check. Lesson: **a backup
   job that can fail silently is worse than no backup job**, because it
   manufactures false confidence.
2. *Honest failure: network unreachable.* Right password, still the direct
   host — which is IPv6-only, and GitHub's runners have no IPv6. Fix: the
   **Session pooler** connection string (IPv4).
3. *Honest failure: version mismatch.* The runner's default `pg_dump` resolved
   to v16 against a v17 server (Ubuntu's wrapper ignored the installed v17
   client). Fix: call `/usr/lib/postgresql/17/bin/pg_dump` explicitly.

Run four: green, 894 KB of real data, and green now actually means green.

## 12. CI and deploys

**What:** both Vercel projects connected to GitHub (`main` → production,
branches → preview URLs) replacing CLI-only deploys, plus
`.github/workflows/check.yml` running `npm run check` (lint + tests + build)
on every push and PR.

**Why:** manual deploys from one machine meant no gate (nothing stopped
deploying with failing tests) and a bus factor of one. With Git-driven
deploys, the deploy is reproducible from the repo, previews come free, and CI
makes a red build visible before anyone's phone sees it.

## 13. Cutover order

**Why the sequence mattered:** DNS and email verification have propagation
delays, so they went first; env vars had to exist before the deploys that
bake them in; the friend-group message ("open the app online once") had to
precede the redirect so offline outboxes flushed to a reachable origin; and
the smoke test (OTP arrives, Google round-trips, PWA installs, AI works,
deletion works, old URL redirects) came last because it exercises every layer
above at once.

---

## The recurring principles

- **Fail closed, verify loudly.** Misconfigured endpoints refuse rather than
  open up; the backup job dies rather than shipping an empty file; every
  "done" was proven by exercising the real path (thrown errors, scripted
  sign-ins, fetched bundles), not by reading a settings page.
- **Secrets stay server-side, public keys are public.** service_role and SMTP
  passwords never touch the client or the repo; the anon key ships in every
  bundle by design and needs no protecting.
- **Don't let infrastructure depend on itself.** The registrar account is not
  on an email the registrar's DNS serves; forwarding-only addresses don't
  guard critical logins.
- **Blast-radius thinking.** Dev is a different database; previews bake dev
  creds; deletion respects co-owned data; the free tiers are fine until the
  known gates (monetization → Vercel Pro + Supabase Pro).
