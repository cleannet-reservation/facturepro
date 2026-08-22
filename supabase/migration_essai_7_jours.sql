-- ============================================================
-- Migration : réduire l'essai gratuit de 14 à 7 jours
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

-- Change la valeur par défaut pour toutes les FUTURES inscriptions
alter table businesses alter column trial_ends_at set default (now() + interval '7 days');

-- Optionnel : si tu veux aussi raccourcir l'essai des comptes DÉJÀ inscrits
-- et encore en période d'essai (ne touche pas ceux déjà actifs/payants).
-- Décommente les 2 lignes ci-dessous si tu veux appliquer ça rétroactivement :

-- update businesses set trial_ends_at = created_at + interval '7 days'
--   where subscription_status = 'trial';
