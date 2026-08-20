-- ============================================================
-- Migration : marque blanche (nom d'app et couleur personnalisables)
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

alter table businesses add column if not exists app_name text default 'FacturePro';
alter table businesses add column if not exists brand_color text default '#22D3EE';
