-- Delete-trip support. ADDITIVE — safe to run on the live database.
-- (Unlike schema.sql, which DROPs the tables. NEVER re-run schema.sql.)
--
-- Run this once in the Supabase SQL editor. Until it's run, the app's
-- "Delete this trip" action falls back to a friendly "run this migration"
-- message (the frontend detects the missing RPC).

-- Destroy a whole trip. SECURITY DEFINER because `trips` has no delete RLS
-- policy — a client `delete from trips` is silently blocked. Only a member may
-- delete, and only when they're the sole member (so you never wipe out data
-- belonging to other people who joined). Deleting the trips row cascades to
-- trip_members and trip_kv via their `on delete cascade` foreign keys.
create or replace function public.delete_trip(p_trip_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare n int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_trip_member(p_trip_id) then
    raise exception 'not a member of this trip';
  end if;
  select count(*) into n from public.trip_members where trip_id = p_trip_id;
  if n > 1 then
    raise exception 'trip has other members — leave it instead of deleting';
  end if;
  delete from public.trips where id = p_trip_id; -- cascades trip_members + trip_kv
end $fn$;

revoke execute on function public.delete_trip(uuid) from public, anon;
grant  execute on function public.delete_trip(uuid) to authenticated;
