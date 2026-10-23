-- Read-only production audit — safe to run anytime (SELECTs only).
-- Run each block in the Supabase SQL editor and compare with the expectations.
-- Expectations below are for a database with migrations 001-010 applied.

-- 1) RLS policies on the three app tables.
--    EXPECT (after 008):
--    trip_kv:      kv_select  USING is_trip_member(trip_id)
--                  kv_insert  WITH CHECK, kv_update USING and WITH CHECK,
--                  kv_delete  USING all read:
--                    ((owner = '__shared__') AND can_edit_shared(trip_id))
--                    OR ((owner = (auth.uid())::text) AND is_trip_member(trip_id))
--    trip_members: members_insert (user_id = auth.uid()),
--                  members_select (user_id = auth.uid() OR is_trip_member(trip_id)),
--                  members_update and members_delete (user_id = auth.uid())
--    trips:        trips_select USING is_trip_member(id) only.
--                  NO trips_insert row (008 drops it; trips are created via the RPC).
select c.relname as table_name,
       p.polname  as policy,
       case p.polcmd when 'r' then 'select' when 'a' then 'insert'
                     when 'w' then 'update' when 'd' then 'delete'
                     else p.polcmd::text end as command,
       pg_get_expr(p.polqual, p.polrelid)      as using_expr,
       pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relname in ('trips', 'trip_members', 'trip_kv')
order by c.relname, p.polname;

-- 2) RPCs the frontend depends on.
--    EXPECT all nine rows:
--    can_edit_shared, consume_ai_credit, create_trip_with_code, delete_trip,
--    is_trip_member, is_trip_organiser, join_trip_with_code,
--    set_member_role, set_members_can_edit
--    (consume_ai_credit is from 006 and used by the api/ functions)
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_trip_with_code', 'join_trip_with_code',
                    'delete_trip', 'is_trip_member', 'consume_ai_credit',
                    'can_edit_shared', 'is_trip_organiser',
                    'set_members_can_edit', 'set_member_role')
order by p.proname;

-- 3) Storage buckets.
--    EXPECT: trip-docs (private, 10MB) only. Before 009 (outfits purge) and
--    its dashboard step, outfit-photos (private, 2MB) is still listed.
select id, public, file_size_limit from storage.buckets order by id;

-- 4) Storage policies for trip-docs.
--    EXPECT: "trip docs read" uses is_trip_member(...);
--    "trip docs insert" and "trip docs delete" use can_edit_shared(...).
select p.polname as policy,
       pg_get_expr(p.polqual, p.polrelid)      as using_expr,
       pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage' and c.relname = 'objects' and p.polname like 'trip docs%'
order by p.polname;

-- 5) Column privileges on trip_members for the app's role (008).
--    EXPECT: UPDATE only on name and color; INSERT only on trip_id, user_id,
--    name and color. No UPDATE or INSERT on role. No table-wide UPDATE row in
--    the second query.
select privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'trip_members'
  and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
order by privilege_type, column_name;

select privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'trip_members'
  and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE');

-- 6) Roles backfill (008).
--    EXPECT: 0 rows. Every trip has at least one organiser, and every pre-008
--    trip (created_by is null) has only organisers.
select t.id, t.code, t.created_by,
       count(*) filter (where m.role = 'organiser') as organisers,
       count(*) filter (where m.role = 'member')    as members
from public.trips t
join public.trip_members m on m.trip_id = t.id
group by t.id, t.code, t.created_by
having count(*) filter (where m.role = 'organiser') = 0
    or (t.created_by is null and count(*) filter (where m.role = 'member') > 0);

-- 7) Realtime publication.
--    EXPECT: trip_kv, trip_members and trips.
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;

-- 8) How much base64 image weight sits in trip_kv today (drives the
--    one-off purge in 007). EXPECT: 0 rows after the purge.
select count(*)                                as base64_rows,
       pg_size_pretty(sum(pg_column_size(value))::bigint) as approx_size
from public.trip_kv
where value::text like '%data:image%';

-- 9) Outfits purge (009).
--    EXPECT: 0 rows after 009. Before it, outfit and try-on rows are listed.
select key, count(*) as rows
from public.trip_kv
where key like 'outfit:%' or key like 'outfit-item:%'
   or key in ('outfit-days', 'tryon-base-photo')
group by key
order by key;

-- 10) Keep an organiser (010).
--    EXPECT: one row, trip_members_keep_an_organiser, on_delete = D, enabled
--    = O. Block 6 covers the result: no trip with members has zero organisers.
select tgname,
       case when tgtype & 8 = 8 then 'D' end as on_delete,
       tgenabled as enabled
from pg_trigger
where tgrelid = 'public.trip_members'::regclass and not tgisinternal;
