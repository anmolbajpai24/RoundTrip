-- ============================================================================
-- Roundtrip · migration 008: organiser and member roles
--
-- ADDITIVE — safe to run on the live database, and safe to run more than once.
-- (Unlike schema.sql, which DROPs the tables. NEVER re-run schema.sql.)
--
-- How to run: paste this whole file into the Supabase SQL editor and click
-- Run. On roundtrip-dev first; on prod only right after a backup. Expect
-- "Success. No rows returned." Then run supabase/AUDIT.sql and compare.
--
-- What it does:
--   * trips gains created_by (who made it) and members_can_edit (default true,
--     so trips keep today's behaviour until an organiser turns it off).
--   * trip_members gains role ('organiser' | 'member'). Every member of a
--     pre-008 trip becomes an organiser, so friend trips work exactly as before.
--   * Members can only change their own name and colour, never their role.
--   * trip_kv writes: shared rows need can_edit_shared(); personal rows can
--     only be written by their owner. Reads are unchanged.
--   * trip-docs uploads and deletes need can_edit_shared(). Reads unchanged.
--   * New organiser-only RPCs set_members_can_edit and set_member_role.
--   * create_trip_with_code records created_by and makes the creator organiser.
--   * trips joins the realtime publication so a members_can_edit change
--     reaches open apps.
--
-- Old app builds keep working on trips where members_can_edit is true (every
-- existing trip). Before this migration, a frontend built for roles falls back
-- to "everyone is an organiser".
-- ============================================================================

-- ---------- columns ----------

alter table public.trips add column if not exists members_can_edit boolean not null default true;

-- Plain uuid, no foreign key on purpose: deleting an account must not null it
-- out, because null is how the backfill below recognises a pre-008 trip.
alter table public.trips add column if not exists created_by uuid;

alter table public.trip_members add column if not exists role text not null default 'member'
  check (role in ('organiser', 'member'));

-- Existing trips never recorded a creator, so everyone on them keeps full
-- rights. created_by is null only on pre-008 trips (create_trip_with_code
-- always sets it from now on), so this is safe to re-run.
update public.trip_members set role = 'organiser'
where role <> 'organiser'
  and trip_id in (select id from public.trips where created_by is null);

-- ---------- column-level grants ----------
-- RLS limits which rows you may touch; these limit which columns. Members may
-- rename or recolour themselves, but role only changes through set_member_role.
revoke update on public.trip_members from anon, authenticated;
grant  update (name, color) on public.trip_members to authenticated;

-- A direct insert of your own membership row (setProfile's fallback) can't
-- pick a role either: it gets the 'member' default.
revoke insert on public.trip_members from anon, authenticated;
grant  insert (trip_id, user_id, name, color) on public.trip_members to authenticated;

-- Trips are created only through create_trip_with_code (SECURITY DEFINER),
-- never by a direct insert. Dropping the open insert policy stops anyone
-- inserting a trip with a forged created_by or members_can_edit.
drop policy if exists trips_insert on public.trips;

-- ---------- helpers ----------

-- Can the caller write this trip's shared rows? Organisers always can;
-- members can when the trip allows it.
create or replace function public.can_edit_shared(t uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members m
    join public.trips tr on tr.id = m.trip_id
    where m.trip_id = t and m.user_id = auth.uid()
      and (m.role = 'organiser' or tr.members_can_edit)
  );
$$;

create or replace function public.is_trip_organiser(t uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = t and m.user_id = auth.uid() and m.role = 'organiser'
  );
$$;

revoke execute on function public.can_edit_shared(uuid)   from public, anon;
revoke execute on function public.is_trip_organiser(uuid) from public, anon;
grant  execute on function public.can_edit_shared(uuid)   to authenticated;
grant  execute on function public.is_trip_organiser(uuid) to authenticated;

-- ---------- trip_kv write policies ----------
-- Shared rows ('__shared__'): can_edit_shared. Personal rows: only the member
-- whose id is the owner, and only while they're a member. kv_select is unchanged.

drop policy if exists kv_insert on public.trip_kv;
create policy kv_insert on public.trip_kv
  for insert to authenticated
  with check (
    (owner = '__shared__' and public.can_edit_shared(trip_id))
    or (owner = auth.uid()::text and public.is_trip_member(trip_id))
  );

drop policy if exists kv_update on public.trip_kv;
create policy kv_update on public.trip_kv
  for update to authenticated
  using (
    (owner = '__shared__' and public.can_edit_shared(trip_id))
    or (owner = auth.uid()::text and public.is_trip_member(trip_id))
  )
  with check (
    (owner = '__shared__' and public.can_edit_shared(trip_id))
    or (owner = auth.uid()::text and public.is_trip_member(trip_id))
  );

drop policy if exists kv_delete on public.trip_kv;
create policy kv_delete on public.trip_kv
  for delete to authenticated
  using (
    (owner = '__shared__' and public.can_edit_shared(trip_id))
    or (owner = auth.uid()::text and public.is_trip_member(trip_id))
  );

-- ---------- trip-docs storage ----------
-- Documents are shared data: uploading or deleting needs can_edit_shared.
-- "trip docs read" (member-only, from 002) is unchanged.

drop policy if exists "trip docs insert" on storage.objects;
create policy "trip docs insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-docs'
    and public.can_edit_shared(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "trip docs delete" on storage.objects;
create policy "trip docs delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trip-docs'
    and public.can_edit_shared(((storage.foldername(name))[1])::uuid)
  );

-- ---------- RPCs ----------

-- Same signature and return shape as 001, so the app needs no change. Now
-- records the creator and makes them the trip's organiser.
create or replace function public.create_trip_with_code(p_code text, p_name text, p_color text)
returns table (trip_id uuid, trip_code text)
language plpgsql security definer set search_path = public as $fn$
declare t public.trips%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.trips (code, created_by) values (upper(p_code), auth.uid()) returning * into t;
  insert into public.trip_members (trip_id, user_id, name, color, role)
    values (t.id, auth.uid(), p_name, p_color, 'organiser');
  return query select t.id, t.code;
end $fn$;

-- Organiser-only: turn "Members can edit" on or off for a trip.
create or replace function public.set_members_can_edit(p_trip_id uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_value is null then
    raise exception 'value is required';
  end if;
  if not public.is_trip_organiser(p_trip_id) then
    raise exception 'only an organiser can change this' using errcode = '42501';
  end if;
  update public.trips set members_can_edit = p_value where id = p_trip_id;
end $fn$;

-- Organiser-only: make a member a co-organiser, or turn an organiser back
-- into a member. Refuses to demote the trip's last organiser.
create or replace function public.set_member_role(p_trip_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  current_role_ text;
  organisers int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_role is null or p_role not in ('organiser', 'member') then
    raise exception 'role must be organiser or member';
  end if;
  if not public.is_trip_organiser(p_trip_id) then
    raise exception 'only an organiser can change roles' using errcode = '42501';
  end if;

  -- Serialise role changes per trip, so two organisers demoting each other at
  -- the same moment can't leave the trip with none.
  perform 1 from public.trips where id = p_trip_id for update;

  select m.role into current_role_ from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = p_user_id;
  if not found then
    raise exception 'that person is not on this trip';
  end if;

  if current_role_ = 'organiser' and p_role = 'member' then
    select count(*) into organisers from public.trip_members m
      where m.trip_id = p_trip_id and m.role = 'organiser';
    if organisers <= 1 then
      raise exception 'a trip needs at least one organiser';
    end if;
  end if;

  update public.trip_members set role = p_role
    where trip_id = p_trip_id and user_id = p_user_id;
end $fn$;

revoke execute on function public.create_trip_with_code(text, text, text)   from public, anon;
revoke execute on function public.set_members_can_edit(uuid, boolean)       from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text)         from public, anon;
grant  execute on function public.create_trip_with_code(text, text, text)   to authenticated;
grant  execute on function public.set_members_can_edit(uuid, boolean)       to authenticated;
grant  execute on function public.set_member_role(uuid, uuid, text)         to authenticated;

-- ---------- realtime ----------
-- trip_members is already published (schema.sql). Add trips so a
-- members_can_edit change reaches open apps. Realtime applies trips_select,
-- so people only hear about their own trips.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;
