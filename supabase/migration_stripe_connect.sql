-- ============================================================
-- Migration : Stripe Connect (chaque entreprise reçoit l'argent
-- directement sur son propre compte Stripe, pas sur celui de la plateforme)
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

alter table businesses add column if not exists stripe_connect_account_id text;
alter table businesses add column if not exists stripe_connect_charges_enabled boolean default false;
