-- ============================================================
-- Migration : abonnement plateforme + super admin
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

-- Statut d'abonnement de chaque entreprise à la plateforme FacturePro
alter table businesses add column if not exists subscription_status text default 'trial'
  check (subscription_status in ('trial', 'active', 'past_due', 'canceled'));
alter table businesses add column if not exists trial_ends_at timestamptz default (now() + interval '14 days');
alter table businesses add column if not exists stripe_customer_id text;
alter table businesses add column if not exists stripe_subscription_id text;

-- Coupe-circuit manuel : l'admin peut bloquer l'accès d'une entreprise
-- indépendamment de son statut d'abonnement Stripe
alter table businesses add column if not exists access_enabled boolean default true;

-- ------------------------------------------------------------
-- Liste des comptes super admin (toi, et personne d'autre par défaut)
-- ------------------------------------------------------------
create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table platform_admins enable row level security;

-- Un utilisateur connecté peut seulement vérifier s'IL est admin,
-- pas voir la liste des autres admins
create policy "Un utilisateur vérifie son propre statut admin" on platform_admins
  for select using (user_id = auth.uid());

-- ------------------------------------------------------------
-- IMPORTANT — dernière étape : te déclarer toi-même comme super admin
-- Remplace TON_USER_ID par ton identifiant Supabase, que tu trouves dans
-- Authentication → Users → clique sur ta ligne → copie le "User UID"
-- ------------------------------------------------------------
-- insert into platform_admins (user_id) values ('TON_USER_ID');
