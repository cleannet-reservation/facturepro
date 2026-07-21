-- ============================================================
-- Migration : stockage du logo entreprise
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

-- Bucket public pour les logos (public = lecture libre, écriture protégée par policy)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Seul le propriétaire connecté peut uploader/modifier/supprimer dans son propre dossier
create policy "Owner upload son logo"
on storage.objects for insert
with check (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owner met à jour son logo"
on storage.objects for update
using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owner supprime son logo"
on storage.objects for delete
using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

-- Lecture publique (nécessaire pour afficher le logo dans les PDF et devis publics)
create policy "Logos visibles publiquement"
on storage.objects for select
using (bucket_id = 'logos');
