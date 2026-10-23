-- ============================================================================
-- Roundtrip · migration 009: purge outfits and try-on data
--
-- DESTRUCTIVE — this permanently deletes every outfit and try-on row and,
-- with the dashboard step below, every outfit and face photo. There is no
-- undo except restoring a backup. Safe to run more than once.
-- (Unlike schema.sql, which DROPs the tables. NEVER re-run schema.sql.)
--
-- When: prod on Sun 1 Nov 2026, right after the operator-build merge to main,
-- and only right after a fresh backup (run the weekly pg_dump workflow by
-- hand, or take a dashboard backup, and confirm it finished). roundtrip-dev
-- can be done any time.
--
-- How to run, in this order:
--   1. Take the backup (prod only).
--   2. Supabase dashboard → Storage → bucket `outfit-photos` → the bucket's
--      "..." menu → "Empty bucket", confirm. Then the same menu → "Delete
--      bucket". Supabase blocks deleting Storage objects from SQL, so this
--      part can't live in this file. This removes the uploaded outfit photos
--      (<trip_id>/<uuid>.jpg).
--   3. Paste this whole file into the SQL editor and click Run. Expect
--      "Success. No rows returned." (the delete reports its row count).
--   4. Run the CHECK queries at the bottom. Expect 0 rows and no bucket.
--
-- What it does:
--   * Deletes every trip_kv row for the removed Outfits tab and try-on:
--       outfit-item:<id>    one row per outfit (holds a photoPath, or an
--                           inline base64 photo from before 007)
--       outfit:<day>        pre-closet per-day outfits (outfit:d7 and
--                           outfit:2026-08-07), often inline base64 photos
--       outfit-days         day → outfit assignment map
--       tryon-base-photo    the face/body photo used for try-on (inline
--                           base64 in the row)
--   * Drops the three `outfit photos ...` Storage policies from 007, so
--     nothing can upload to the bucket again even if it isn't deleted.
--
-- The app build that ships with this no longer reads or writes any of these
-- keys, skips them when restoring an old backup, and clears them from each
-- device's IndexedDB cache. A phone still on an old cached build could write
-- an outfit row again before it updates; just run this file again.
-- ============================================================================

delete from public.trip_kv
where key like 'outfit:%'
   or key like 'outfit-item:%'
   or key in ('outfit-days', 'tryon-base-photo');

drop policy if exists "outfit photos read"   on storage.objects;
drop policy if exists "outfit photos insert" on storage.objects;
drop policy if exists "outfit photos delete" on storage.objects;

-- ---------------------------------------------------------------------------
-- CHECK — run after steps 2 and 3. Each should return no rows.
-- ---------------------------------------------------------------------------
-- select trip_id, owner, key from public.trip_kv
--   where key like 'outfit:%' or key like 'outfit-item:%'
--      or key in ('outfit-days', 'tryon-base-photo');
--
-- select id from storage.buckets where id = 'outfit-photos';
--
-- select name from storage.objects where bucket_id = 'outfit-photos' limit 5;
--
-- select polname from pg_policy where polname like 'outfit photos%';
