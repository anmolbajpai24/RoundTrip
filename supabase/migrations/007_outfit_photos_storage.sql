-- ============================================================================
-- Roundtrip · migration 007: outfit photos move to Supabase Storage
--
-- The bucket + policies below are ADDITIVE — safe to run any time.
-- The purge at the bottom is a ONE-OFF and must run AFTER the frontend that
-- writes photoPath (not base64 `photo`) is deployed.
--
-- Before this, outfit photos were base64 JPEG data-URLs inside trip_kv jsonb
-- values, so every member's whole closet re-downloaded on every boot and every
-- realtime change. Now files live at  <trip_id>/<uuid>.jpg  in the private
-- `outfit-photos` bucket (same member-only policy shape as trip-docs), and the
-- kv value stores just the path.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('outfit-photos', 'outfit-photos', false, 2097152) -- 2 MB; compressed uploads are ~100-250 KB
on conflict (id) do nothing;

drop policy if exists "outfit photos read" on storage.objects;
create policy "outfit photos read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'outfit-photos'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "outfit photos insert" on storage.objects;
create policy "outfit photos insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'outfit-photos'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "outfit photos delete" on storage.objects;
create policy "outfit photos delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'outfit-photos'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- PURGE — deletes only outfit rows that carry inline base64 images (the old
-- format). Owner confirmed those photos are disposable (16 Jul 2026).
--
-- Safe to run at ANY time and MORE THAN ONCE: rows written by the new build
-- store a photoPath string (no data:image payload) and are never matched, so
-- no coordination with other devices is needed. If a phone on a stale cached
-- build adds another base64 photo later, just run this again.
-- (Day-assignment `outfit-days` rows are left in place — entries pointing at
-- purged items are simply rendered as "nothing planned".)
-- ---------------------------------------------------------------------------
-- delete from public.trip_kv
--   where (key like 'outfit-item:%' or key like 'outfit:%')
--     and value::text like '%data:image%';
