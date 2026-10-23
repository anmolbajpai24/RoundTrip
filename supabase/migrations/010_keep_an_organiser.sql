-- ============================================================================
-- Roundtrip · migration 010: a trip always keeps an organiser
--
-- ADDITIVE — safe to run on the live database, and safe to run more than once.
-- (Unlike schema.sql, which DROPs the tables. NEVER re-run schema.sql.)
--
-- Needs 008 (roles) first: it uses trip_members.role.
--
-- How to run: paste this whole file into the Supabase SQL editor and click
-- Run. On roundtrip-dev first; on prod only right after a backup. Expect
-- "Success. No rows returned." Then run the check query at the bottom (or
-- block 10 of supabase/AUDIT.sql): it should return 0 rows.
--
-- What it does:
--   * When a trip's last organiser leaves (their trip_members row is
--     deleted, by leaveTrip, by account deletion, or by any cascade), the
--     earliest-joined remaining member becomes organiser. If nobody is left,
--     nothing happens.
--   * One-off repair: any trip that already has members but no organiser
--     (possible on a database that ran 008 before this file) gets one the
--     same way.
--
-- Why a trigger: leaving is a plain delete of your own row under the
-- members_delete policy, and account deletion runs as the service role. A
-- trigger covers both without either caller changing, and the promotion
-- happens in the same transaction as the delete, so there is no moment where
-- the trip has no organiser.
--
-- The function is SECURITY DEFINER with a fixed search_path: the member who
-- leaves has no UPDATE grant on trip_members.role (008's column grants), but
-- the function runs as its owner, which does. It only ever promotes, and only
-- when no organiser remains, so it can't be used to gain rights.
-- ============================================================================

create or replace function public.keep_an_organiser()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  -- Only an organiser leaving can leave a trip without one.
  if old.role is distinct from 'organiser' then
    return null;
  end if;

  -- Serialise with set_member_role (which locks the same row) and with other
  -- organisers leaving at the same moment, so two organisers leaving together
  -- can't both see the other one and skip the promotion. If the trip itself
  -- is being deleted (cascade), the row is already gone and this is a no-op.
  perform 1 from public.trips where id = old.trip_id for update;

  if exists (
    select 1 from public.trip_members
    where trip_id = old.trip_id and role = 'organiser'
  ) then
    return null;
  end if;

  update public.trip_members set role = 'organiser'
  where trip_id = old.trip_id
    and user_id = (
      select user_id from public.trip_members
      where trip_id = old.trip_id
      order by joined_at, user_id
      limit 1
    );

  return null;
end $fn$;

-- Trigger functions can't be called directly, but keep the grant list tidy.
revoke execute on function public.keep_an_organiser() from public, anon, authenticated;

-- AFTER ... FOR EACH ROW: in a multi-row delete (or a cascade) each row's
-- trigger runs once the whole statement is done, so it sees who is really
-- left. create trigger has no "if not exists", hence drop first.
drop trigger if exists trip_members_keep_an_organiser on public.trip_members;
create trigger trip_members_keep_an_organiser
  after delete on public.trip_members
  for each row execute function public.keep_an_organiser();

-- ---------- one-off repair ----------
-- Trips with members but no organiser get their earliest-joined member
-- promoted. Re-running finds nothing to do.
update public.trip_members m set role = 'organiser'
from (
  select distinct on (trip_id) trip_id, user_id
  from public.trip_members
  where trip_id in (
    select trip_id from public.trip_members
    group by trip_id
    having count(*) filter (where role = 'organiser') = 0
  )
  order by trip_id, joined_at, user_id
) pick
where m.trip_id = pick.trip_id and m.user_id = pick.user_id;

-- ---------- check (run separately; read-only) ----------
-- EXPECT: 0 rows. Every trip with members has at least one organiser.
--
--   select trip_id, count(*) as members
--   from public.trip_members
--   group by trip_id
--   having count(*) filter (where role = 'organiser') = 0;
--
-- And the trigger exists. EXPECT one row: trip_members_keep_an_organiser, D.
--
--   select tgname, case when tgtype & 8 = 8 then 'D' end as on_delete
--   from pg_trigger
--   where tgrelid = 'public.trip_members'::regclass and not tgisinternal;
