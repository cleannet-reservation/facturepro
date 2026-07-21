-- ============================================================
-- Migration : factures d'acompte + crédit d'impôt Services à la Personne
-- À exécuter dans le SQL Editor de ton projet Supabase existant
-- ============================================================

-- Entreprise : agrément Services à la Personne (crédit d'impôt 50%)
alter table businesses add column if not exists sap_eligible boolean default false;
alter table businesses add column if not exists sap_agrement_number text;

-- Devis : le client est-il éligible au crédit d'impôt sur cette prestation ?
alter table quotes add column if not exists tax_credit_eligible boolean default false;

-- Factures : type de facture (standard / acompte / solde) + lien vers le devis d'origine
alter table invoices add column if not exists invoice_type text default 'standalone'
  check (invoice_type in ('standalone', 'acompte', 'solde'));
alter table invoices add column if not exists tax_credit_eligible boolean default false;

-- Un index pour retrouver rapidement toutes les factures liées à un même devis
create index if not exists idx_invoices_quote_id on invoices(quote_id);
