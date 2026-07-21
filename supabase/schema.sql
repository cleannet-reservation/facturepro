-- ============================================================
-- FacturePro — Schéma Supabase (Phase 1)
-- À exécuter dans l'éditeur SQL de ton nouveau projet Supabase
-- ============================================================

-- Extension pour les UUID
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Entreprises (une seule ligne pour toi en Phase 1,
--    mais structure déjà prête pour du multi-tenant plus tard)
-- ------------------------------------------------------------
create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  name text not null,
  siret text,
  address text,
  postal_code text,
  city text,
  email text,
  phone text,
  tax_regime text not null default 'franchise' check (tax_regime in ('franchise', 'assujetti')),
  tva_number text,
  logo_url text,
  iban text,
  payment_terms text default '30 jours',
  quote_next_number int default 1,
  invoice_next_number int default 1,
  stripe_secret_key text, -- clé Stripe restreinte, stockée côté serveur uniquement (voir note sécurité en bas)
  sap_eligible boolean default false, -- agrément Services à la Personne (crédit d'impôt 50%)
  sap_agrement_number text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. Clients
-- ------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  address text,
  postal_code text,
  city text,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. Devis
-- ------------------------------------------------------------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  client_id uuid references clients(id) not null,
  number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'refused', 'expired')),
  issue_date date not null default current_date,
  validity_date date,
  subtotal_ht numeric(10,2) default 0,
  tva_amount numeric(10,2) default 0,
  total_ttc numeric(10,2) default 0,
  notes text,
  accepted_at timestamptz,
  accepted_by_name text,
  tax_credit_eligible boolean default false, -- client particulier éligible au crédit d'impôt 50%
  public_token uuid default gen_random_uuid(), -- pour le lien de consultation client
  created_at timestamptz default now()
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  tva_rate numeric(4,2) not null default 0,
  position int not null default 0
);

-- ------------------------------------------------------------
-- 4. Factures
-- ------------------------------------------------------------
create table invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  client_id uuid references clients(id) not null,
  quote_id uuid references quotes(id),
  number text not null,
  invoice_type text not null default 'standalone' check (invoice_type in ('standalone', 'acompte', 'solde')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue')),
  issue_date date not null default current_date,
  due_date date,
  subtotal_ht numeric(10,2) default 0,
  tva_amount numeric(10,2) default 0,
  total_ttc numeric(10,2) default 0,
  deposit_requested numeric(10,2) default 0,
  deposit_paid numeric(10,2) default 0,
  tax_credit_eligible boolean default false,
  stripe_payment_link_url text,
  notes text,
  public_token uuid default gen_random_uuid(),
  created_at timestamptz default now()
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  tva_rate numeric(4,2) not null default 0,
  position int not null default 0
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade not null,
  amount numeric(10,2) not null,
  type text not null check (type in ('deposit', 'balance')),
  stripe_payment_intent_id text,
  paid_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 5. Row Level Security — chaque utilisateur ne voit que ses données
-- ------------------------------------------------------------
alter table businesses enable row level security;
alter table clients enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;

create policy "Owner accède à sa business" on businesses
  for all using (owner_id = auth.uid());

create policy "Owner accède à ses clients" on clients
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Owner accède à ses devis" on quotes
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Owner accède aux lignes de devis" on quote_items
  for all using (quote_id in (
    select id from quotes where business_id in (select id from businesses where owner_id = auth.uid())
  ));

create policy "Owner accède à ses factures" on invoices
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Owner accède aux lignes de facture" on invoice_items
  for all using (invoice_id in (
    select id from invoices where business_id in (select id from businesses where owner_id = auth.uid())
  ));

create policy "Owner accède aux paiements" on payments
  for all using (invoice_id in (
    select id from invoices where business_id in (select id from businesses where owner_id = auth.uid())
  ));

-- ------------------------------------------------------------
-- 6. Factures d'achat, notes de frais, factures récurrentes
-- ------------------------------------------------------------
create table purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  supplier_name text not null,
  description text,
  amount numeric(10,2) not null default 0,
  purchase_date date not null default current_date,
  category text,
  notes text,
  created_at timestamptz default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  description text not null,
  amount numeric(10,2) not null default 0,
  expense_date date not null default current_date,
  category text,
  reimbursable boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  client_id uuid references clients(id) not null,
  description text not null,
  amount numeric(10,2) not null default 0,
  tva_rate numeric(4,2) not null default 0,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  next_run_date date not null default current_date,
  active boolean default true,
  last_generated_at timestamptz,
  created_at timestamptz default now()
);

alter table purchases enable row level security;
alter table expenses enable row level security;
alter table recurring_invoices enable row level security;

create policy "Owner accède à ses achats" on purchases
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Owner accède à ses notes de frais" on expenses
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Owner accède à ses factures récurrentes" on recurring_invoices
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

-- ------------------------------------------------------------
-- NOTE SÉCURITÉ IMPORTANTE :
-- La colonne businesses.stripe_secret_key ne doit JAMAIS être lue
-- depuis le frontend. Elle sera utilisée uniquement par une fonction
-- serverless (Vercel API route) pour créer les liens de paiement.
-- On la mettra en place à la Phase 4 (intégration Stripe).
-- ------------------------------------------------------------
