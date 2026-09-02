-- ============================================================
-- Migration : type de client (particulier / professionnel)
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

alter table clients add column if not exists client_type text default 'particulier'
  check (client_type in ('particulier', 'professionnel'));
alter table clients add column if not exists company_name text;
alter table clients add column if not exists tva_number text;
alter table clients add column if not exists siren_siret text;
alter table clients add column if not exists naf_code text;
alter table clients add column if not exists language text default 'fr' check (language in ('fr', 'en'));
alter table clients add column if not exists address_complement text;
alter table clients add column if not exists website text;
