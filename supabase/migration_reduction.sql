-- ============================================================
-- Migration : réduction (pourcentage ou montant) sur devis et factures
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

alter table quotes add column if not exists discount_type text default 'none'
  check (discount_type in ('none', 'percent', 'amount'));
alter table quotes add column if not exists discount_value numeric(10,2) default 0;
alter table quotes add column if not exists discount_amount numeric(10,2) default 0;

alter table invoices add column if not exists discount_type text default 'none'
  check (discount_type in ('none', 'percent', 'amount'));
alter table invoices add column if not exists discount_value numeric(10,2) default 0;
alter table invoices add column if not exists discount_amount numeric(10,2) default 0;
