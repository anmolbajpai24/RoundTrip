-- Public-launch hardening. ADDITIVE — safe to run on the live database.
-- (Unlike schema.sql, which DROPs the tables. NEVER re-run schema.sql.)
--
-- Run this in two stages from the Supabase SQL editor:
--   STAGE 1 (before deploying the RPC-aware frontend): everything above the
--           "STAGE 2" marker. Creates the create/join RPCs; the frontend
--           auto-detects and uses them, and still falls back to direct table
--           access while the old policy is in place.
--   STAGE 2 (after the frontend deploy is live): the policy swap at the
--           bottom. Closes the "anyone can list every trip code" hole.

-- ---------- STAGE 1: RPCs ----------

-- Create a trip and its first membership atomically. SECURITY DEFINER so it
-- works once trips_select becomes members-only (a plain INSERT ... RETURNING
-- fails RLS for the not-yet-member creator).
create or replace function public.create_trip_with_code(p_code text, p_name text, p_color text)
returns table (trip_id uuid, trip_code text)
language plpgsql security definer set search_path = public as $fn$
declare t public.trips%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.trips (code) values (upper(p_code)) returning * into t;
  insert into public.trip_members (trip_id, user_id, name, color)
    values (t.id, auth.uid(), p_name, p_color);
  return query select t.id, t.code;
end $fn$;

-- Join a trip by code. Returns no rows when the code doesn't exist.
create or replace function public.join_trip_with_code(p_code text, p_name text, p_color text)
returns table (trip_id uuid, trip_code text)
language plpgsql security definer set search_path = public as $fn$
declare t public.trips%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into t from public.trips where code = upper(trim(p_code));
  if not found then return; end if;
  insert into public.trip_members (trip_id, user_id, name, color)
    values (t.id, auth.uid(), p_name, p_color)
    on conflict (trip_id, user_id) do update set name = excluded.name, color = excluded.color;
  return query select t.id, t.code;
end $fn$;

revoke execute on function public.create_trip_with_code(text, text, text) from public, anon;
revoke execute on function public.join_trip_with_code(text, text, text) from public, anon;
grant execute on function public.create_trip_with_code(text, text, text) to authenticated;
grant execute on function public.join_trip_with_code(text, text, text) to authenticated;

-- ---------- STAGE 2: tighten trips_select (run AFTER the frontend deploy) ----------
-- Before this, any signed-in user can enumerate every trip code and join any
-- trip. After it, trips are only visible to their members; create/join go
-- through the RPCs above.
--
-- drop policy if exists trips_select on public.trips;
-- create policy trips_select on public.trips
--   for select to authenticated using (public.is_trip_member(id));
