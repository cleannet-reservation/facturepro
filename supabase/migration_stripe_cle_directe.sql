-- ============================================================
-- Migration : clé Stripe et webhook directement par entreprise
-- (solution plus simple que Stripe Connect)
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

-- stripe_secret_key existe déjà dans le schéma de base, cette ligne
-- ne fait rien si c'est déjà le cas (sécurité si jamais elle manque)
alter table businesses add column if not exists stripe_secret_key text;
alter table businesses add column if not exists stripe_webhook_secret text;
