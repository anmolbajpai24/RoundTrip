# Supabase setup (one-time, ~5 minutes)

This app now syncs across devices using [Supabase](https://supabase.com) (free tier is
plenty for two people). Do these steps once, then fill in `.env.local`.

## 1. Create the project
1. Go to <https://supabase.com>, sign in, click **New project**.
2. Name it anything (e.g. `london-loop`), set a database password (you won't need it
   day-to-day), pick the region closest to you, and create it. Wait ~1 minute for it to spin up.

## 2. Run the schema
1. In the project, open **SQL Editor** (left sidebar) → **New query**.
2. Copy the entire contents of [`schema.sql`](./schema.sql), paste it in, and click **Run**.
   You should see "Success. No rows returned."

## 3. Turn on anonymous sign-in
1. Go to **Authentication** → **Sign In / Providers** (or **Providers**).
2. Find **Anonymous sign-ins** and toggle it **ON**. Save.
   (This lets each device get a private user id with no email/password.)

## 4. Get your keys
1. Go to **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** and the **anon / public** API key.

## 5. Fill in `.env.local`
In the project root, copy `.env.example` to `.env.local` and paste your values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

Then run `npm run dev`. On first launch you'll see the onboarding screen:
**Create trip** on your phone, share the code, and **Join trip** on hers.

> The `anon` key is safe to ship in a client app — it only grants what the
> Row-Level Security policies in `schema.sql` allow (access to trips you're a
> member of). Do **not** paste the `service_role` key anywhere in this app.
