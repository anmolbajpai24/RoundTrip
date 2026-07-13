# Supabase setup (one-time, ~10 minutes)

The app syncs across devices and handles accounts using [Supabase](https://supabase.com)
(free tier is plenty to start). Do these steps once, then fill in `.env.local`.

## 1. Create the project
1. Go to <https://supabase.com>, sign in, click **New project**.
2. Name it anything (e.g. `roundtrip`), set a database password (you won't need it
   day-to-day), pick the region closest to your users, and create it. Wait ~1 minute.

## 2. Run the schema (first time ONLY)
1. In the project, open **SQL Editor** (left sidebar) → **New query**.
2. Copy the entire contents of [`schema.sql`](./schema.sql), paste it in, and click **Run**.
   You should see "Success. No rows returned."

> ⚠️ **Never run `schema.sql` again on a live project** — it drops the tables
> and wipes every trip. Later changes are additive files in [`migrations/`](./migrations/).

## 3. Run the hardening migration
1. New SQL query → paste **Stage 1** of
   [`migrations/001_public_hardening.sql`](./migrations/001_public_hardening.sql) and run it.
2. Once the app frontend build that uses the RPCs is deployed, run the
   commented-out **Stage 2** policy swap at the bottom of the same file.
   (Stage 2 closes the "anyone can enumerate trip codes" gap — required before
   sharing the app publicly.)

## 4. Auth providers
Go to **Authentication** → **Sign In / Providers**:

1. **Anonymous sign-ins → ON.** This is how guests use the app with zero sign-up.
2. **Email → ON**, with "Confirm email" style OTP (default works). For anything
   beyond light testing, configure **custom SMTP** (Project Settings → Auth →
   SMTP) — e.g. a free [Resend](https://resend.com) account — because Supabase's
   built-in mailer is limited to ~2 emails/hour.
3. **Google → ON.** Create an OAuth client in Google Cloud Console
   (APIs & Services → Credentials → OAuth client ID → Web application), add the
   callback URL Supabase shows you on the Google provider card, then paste the
   client ID + secret into Supabase.
4. Under **Authentication → Advanced** (or the provider page), make sure
   **manual account linking** is enabled — guests upgrade to a permanent
   account via `linkIdentity`/email change, which needs it.
5. Under **Authentication → URL Configuration**, add your local dev URL
   (`http://localhost:5173`) and your production URL to the redirect allowlist.

## 5. Get your keys
1. Go to **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** and the **anon / public** API key.

## 6. Fill in `.env.local`
In the project root, copy `.env.example` to `.env.local` and paste your values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

Then run `npm run dev`. On first launch you'll see the onboarding screen:
**Plan a new trip** walks you through dates, money and destinations, then gives
you a code others use to **Join**.

> The `anon` key is safe to ship in a client app — it only grants what the
> Row-Level Security policies allow (access to trips you're a member of).
> Do **not** paste the `service_role` key anywhere in this app.
