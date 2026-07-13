-- ============================================================================
-- Roundtrip · migration 002: documents wallet (Supabase Storage)
--
-- ADDITIVE — safe to run on a live database, any time, in the SQL editor.
--
-- Creates a private bucket `trip-docs` for tickets / PDFs / screenshots.
-- Files live at  <trip_id>/<uuid>-<filename> , and the policies below let any
-- member of that trip read, upload and delete them (reusing the
-- public.is_trip_member() helper from schema.sql). Document metadata itself
-- lives in trip_kv under the shared key 'trip-documents'.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('trip-docs', 'trip-docs', false, 10485760) -- 10 MB per file
on conflict (id) do nothing;

drop policy if exists "trip docs read" on storage.objects;
create policy "trip docs read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-docs'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "trip docs insert" on storage.objects;
create policy "trip docs insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-docs'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "trip docs delete" on storage.objects;
create policy "trip docs delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trip-docs'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );
