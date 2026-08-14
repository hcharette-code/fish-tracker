-- Adds storage for the original handwritten report photo, linked to the
-- trip it was transcribed into. The photo itself can contain the group
-- name / guest first names (identifying info), so it's treated like guest
-- data: anon can upload it (needed for the public upload-photo flow) but
-- can never read it back — only the authenticated guest-info login can.

alter table trips add column report_photo_path text;

insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

-- anon can upload (insert) but not list/read/overwrite/delete
create policy "anon can upload report photos" on storage.objects
  for insert to anon
  with check (bucket_id = 'report-photos');

-- authenticated (the guest-info login) can fully manage report photos
create policy "authenticated can manage report photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'report-photos')
  with check (bucket_id = 'report-photos');
