# Launch checklist — roundtrip.one

The repo side (landing site, account deletion, Sentry, CI, backups, redirect)
is done in code. Everything below is dashboard/DNS work only you can do, in
order. Tick as you go.

## 1. Vercel projects & domains (domain is on GoDaddy)

Do the Vercel half first — it tells you the exact DNS values to type into
GoDaddy.

**In Vercel:**

- [ ] Existing app project → Settings → Domains → Add → `app.roundtrip.one`.
      Vercel shows a record like `CNAME  app → cname.vercel-dns.com.` (it may
      show a project-specific host like `cname.vercel-dns-XXX.com` — always
      copy the exact value from this screen). Leave the tab open.
- [ ] Create new project `roundtrip-landing` from the same GitHub repo with
      **Root Directory = `landing`**, Framework Preset = Other (static).
      Add domains `roundtrip.one` and `www.roundtrip.one` (choose "redirect
      www → roundtrip.one" when asked). Vercel shows an `A` record for the
      apex (classically `76.76.21.21`) and a `CNAME` for `www` — again, copy
      the exact values it displays.
- [ ] Connect **both** projects to the GitHub repo (`anmolbajpai24/RoundTrip`),
      production branch `main`. This replaces CLI deploys: push to main = prod,
      branches = preview URLs.

**In GoDaddy** (godaddy.com → sign in → My Products → Domains →
`roundtrip.one` → **Manage DNS** / "DNS" button):

- [ ] Delete the default **Parked** `A` record for `@` (and any
      "Domain Forwarding" / Website Builder records) — Vercel's apex record
      can't coexist with it.
- [ ] Add record → Type `A`, Name `@`, Value = the IP Vercel showed for
      `roundtrip.one` (e.g. `76.76.21.21`), TTL default.
- [ ] Add record → Type `CNAME`, Name `app`, Value = the host Vercel showed
      for `app.roundtrip.one` (e.g. `cname.vercel-dns.com`), TTL default.
- [ ] Add record → Type `CNAME`, Name `www`, Value = the host Vercel showed
      for `www.roundtrip.one`, TTL default.
- [ ] GoDaddy sometimes appends the domain automatically — the Name field
      should read exactly `app`, not `app.roundtrip.one.roundtrip.one`.

**Back in Vercel:**

- [ ] Wait for each domain's status to turn green/Valid (usually minutes,
      up to ~1 h for GoDaddy TTLs). SSL certificates are issued automatically —
      nothing to do.
- [ ] Enable **Web Analytics** on both projects (Analytics tab → Enable).
      The code is already wired (`<Analytics/>` in the app, script tag on landing).
- [ ] Keep the app project's `round-trip-mauve.vercel.app` domain attached —
      vercel.json 308-redirects it to app.roundtrip.one.

## 2. Supabase (prod project)

- [ ] Authentication → URL Configuration: Site URL = `https://app.roundtrip.one`;
      add `https://app.roundtrip.one/**` to Redirect URLs.
- [ ] Google Cloud console → the OAuth client used for Google sign-in: add
      `https://app.roundtrip.one` to authorized JavaScript origins (the redirect
      URI stays the Supabase callback URL — unchanged).
- [ ] Copy the **service_role** key → Vercel app project env var
      `SUPABASE_SERVICE_ROLE_KEY` (Production + Preview, **never** VITE_-prefixed).
      Account deletion 503s until this is set.

## 3. Resend (auth emails)

- [ ] Create a Resend account, add domain `roundtrip.one`, then add the 3-4
      records it lists (DKIM TXT + SPF MX/TXT, all on subdomains like
      `resend._domainkey` and `send`) in the same GoDaddy Manage DNS screen as
      step 1. Wait for Verified (can take up to an hour).
- [ ] Create an SMTP password (Resend → SMTP).
- [ ] Supabase → Authentication → Emails → SMTP Settings: host
      `smtp.resend.com`, port 465, user `resend`, the SMTP password, sender
      `login@roundtrip.one`, sender name `Roundtrip`.
- [ ] Send yourself a login code to confirm delivery + branding.

## 4. Support email

GoDaddy no longer bundles free email forwarding with most domain plans, so use
[ImprovMX](https://improvmx.com) (free tier) — it just needs two MX records:

- [ ] ImprovMX: add domain `roundtrip.one`, alias `support` → your Gmail.
- [ ] GoDaddy Manage DNS: add `MX` Name `@` Value `mx1.improvmx.com`
      Priority `10`, and `MX` Name `@` Value `mx2.improvmx.com` Priority `20`
      (delete any existing `@` MX records first). Optionally add TXT `@` =
      `v=spf1 include:spf.improvmx.com ~all` — this doesn't clash with
      Resend, whose SPF lives on the `send` subdomain.
- [ ] Email `support@roundtrip.one` from another account and confirm it lands
      in your Gmail. The landing footer, ToS, privacy policy and app already
      link to it.
- [ ] (If your GoDaddy plan happens to include free forwarding, that works
      too — skip ImprovMX and set `support@` → Gmail there instead.)

## 5. Sentry

- [ ] Create a Sentry org + two projects: `roundtrip` (browser/react) and
      optionally reuse it for the API functions.
- [ ] Vercel app project env vars:
      - `VITE_SENTRY_DSN` (Production) — browser DSN
      - `SENTRY_DSN` (Production) — same or a node DSN, used by api/ functions
      - `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (Production) —
        enables source-map upload during the Vercel build.
- [ ] After first deploy: throw a test error and confirm a readable stack.

## 6. Dev environment (stop developing against prod)

- [ ] Create a second Supabase project `roundtrip-dev` (free tier).
- [ ] SQL editor: run `supabase/schema.sql`, then migrations 001→007 in order.
- [ ] Dashboard toggles per `supabase/SETUP.md`: anonymous sign-ins ON, email
      provider ON, Google ON, "Allow manual linking" ON.
- [ ] Point local `.env.local` at the dev project's URL + anon key.
- [ ] Vercel app project: scope the Supabase env vars — Production = prod
      project, Preview + Development = dev project.

## 7. Backups

- [ ] GitHub repo → Settings → Secrets → Actions: add `SUPABASE_DB_URL` =
      the **Session pooler** connection string (Supabase → Connect → Session
      pooler, port 5432; the direct host is IPv6-only and GitHub runners can't
      reach it).
- [ ] Actions tab → "Database backup" → Run workflow once; download the
      artifact and restore it into `roundtrip-dev` to prove it's restorable.

## 8. Uptime

- [ ] UptimeRobot (free): HTTP monitors on `https://roundtrip.one` and
      `https://app.roundtrip.one`, alert to your email.

## 9. Cutover

- [ ] Tell the friend group: open the app once while online (flushes offline
      outboxes), then expect a one-time re-login + reinstall at
      app.roundtrip.one.
- [ ] Push/merge to main → both projects deploy.
- [ ] Smoke test on a phone at app.roundtrip.one:
      - [ ] email OTP arrives from `login@roundtrip.one`
      - [ ] Google sign-in round-trips back to the app
      - [ ] PWA installs (iOS Safari + Android Chrome)
      - [ ] AI itinerary suggestion works
      - [ ] delete a **throwaway** account: auth user, kv rows and photos gone;
            a shared trip with another member survives
      - [ ] old vercel.app URL redirects
- [ ] Capture landing screenshots (itinerary / packing / outfits tabs with a
      good-looking demo trip, phone viewport), save as
      `landing/shots/{itinerary,packing,outfits}.png`, swap the placeholder
      blocks in `landing/index.html`, and replace `landing/og.png` with a real
      1200×630 social image.

## Later gates (not now)

- Monetization → Vercel Pro ($20/mo, Hobby bans commercial use) + consider
  Supabase Pro ($25/mo: daily managed backups, no free-tier project pausing).
- Traffic growth → revisit Supabase free-tier limits (500MB DB, 1GB storage,
  50k MAU) and Gemini free-tier quota (`AI_DAILY_CAP` currently 10/user/day).
