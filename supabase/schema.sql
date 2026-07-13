-- Roundtrip — Supabase schema (FIRST-TIME SETUP ONLY)
-- Paste this whole file into the Supabase SQL editor and run it once.
-- See supabase/SETUP.md for the click-by-click walkthrough.
--
-- ⚠️ DO NOT RE-RUN THIS ON A LIVE DATABASE. It DROPS and recreates the trip
-- tables, wiping every trip, member and all synced data. Schema changes after
-- first setup belong in supabase/migrations/ as additive SQL.

drop table if exists public.trip_kv       cascade;
drop table if exists public.trip_members  cascade;
drop table if exists public.trips         cascade;

-- ------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------

-- A trip is the shared container. `code` is the short secret people exchange
-- to sync their devices to the same trip.
create table public.trips (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  created_at timestamptz not null default now()
);

-- Each member of a trip: an anonymous auth user, plus the display name and
-- colour they chose for themselves during onboarding.
create table public.trip_members (
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null default auth.uid(),
  name      text not null,
  color     text not null default '#1D2433',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- The key/value store. Mirrors the old idb-keyval model 1:1.
--   owner = '__shared__'      -> shared slice (everyone reads/writes)
--   owner = a member user_id  -> that member's personal slice
-- Everyone in the trip can read every row (so we can show "who added what");
-- writes to a personal slice are done by that member.
create table public.trip_kv (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  owner      text not null default '__shared__',
  key        text not null,              -- 'trip-itinerary', 'trip-packing', 'outfit:d7', ...
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (trip_id, owner, key)
);

create index trip_kv_trip_idx on public.trip_kv (trip_id);

-- ------------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------------

alter table public.trips        enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_kv      enable row level security;

-- Helper: is the current auth user a member of this trip?
-- SECURITY DEFINER so it bypasses RLS internally (avoids policy recursion).
create or replace function public.is_trip_member(t uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = t and m.user_id = auth.uid()
  );
$$;

-- --- trips ---------------------------------------------------------
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips
  for insert to authenticated with check (true);

-- Readable by anyone signed in, so a joiner can look a trip up by code.
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated using (true);

-- --- trip_members --------------------------------------------------
-- You may add only your own membership row.
drop policy if exists members_insert on public.trip_members;
create policy members_insert on public.trip_members
  for insert to authenticated with check (user_id = auth.uid());

-- You can see the members of trips you belong to, AND always your own row
-- (the "always your own" part lets you insert/update it before membership is
-- otherwise visible).
drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_trip_member(trip_id));

-- You may edit/remove only your own membership (rename, recolour).
drop policy if exists members_update on public.trip_members;
create policy members_update on public.trip_members
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists members_delete on public.trip_members;
create policy members_delete on public.trip_members
  for delete to authenticated using (user_id = auth.uid());

-- --- trip_kv -------------------------------------------------------
-- Full read/write to any row of a trip you are a member of.
drop policy if exists kv_select on public.trip_kv;
create policy kv_select on public.trip_kv
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists kv_insert on public.trip_kv;
create policy kv_insert on public.trip_kv
  for insert to authenticated with check (public.is_trip_member(trip_id));

drop policy if exists kv_update on public.trip_kv;
create policy kv_update on public.trip_kv
  for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

drop policy if exists kv_delete on public.trip_kv;
create policy kv_delete on public.trip_kv
  for delete to authenticated using (public.is_trip_member(trip_id));

-- ------------------------------------------------------------------
-- Realtime — let clients subscribe to live changes
-- ------------------------------------------------------------------
alter publication supabase_realtime add table public.trip_kv;
alter publication supabase_realtime add table public.trip_members;
