-- Read-only production audit — safe to run anytime (SELECTs only).
-- Run each block in the Supabase SQL editor and compare with the expectations.

-- 1) RLS policies on the three app tables.
--    EXPECT: trips_select shows "true" as its USING expression until
--    migration 005 is applied; after 005 it shows is_trip_member(id).
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
--    EXPECT: all four rows present:
--    create_trip_with_code, join_trip_with_code, delete_trip, is_trip_member
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_trip_with_code', 'join_trip_with_code',
                    'delete_trip', 'is_trip_member')
order by p.proname;

-- 3) Storage buckets.
--    EXPECT: trip-docs (private, 10MB). After migration 007 you'll also
--    see outfit-photos (private, 2MB).
select id, public, file_size_limit from storage.buckets order by id;

-- 4) How much base64 image weight sits in trip_kv today (drives the
--    one-off purge in 007). EXPECT: drops to 0 rows after the purge.
select count(*)                                as base64_rows,
       pg_size_pretty(sum(pg_column_size(value))::bigint) as approx_size
from public.trip_kv
where value::text like '%data:image%';
