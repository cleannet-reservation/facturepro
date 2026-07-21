-- ============================================================
-- Migration : Factures d'achat, Notes de frais, Factures récurrentes
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

-- ------------------------------------------------------------
-- Factures d'achat (tes dépenses fournisseurs)
-- ------------------------------------------------------------
create table if not exists purchases (
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

alter table purchases enable row level security;
create policy "Owner accède à ses achats" on purchases
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

-- ------------------------------------------------------------
-- Notes de frais
-- ------------------------------------------------------------
create table if not exists expenses (
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

alter table expenses enable row level security;
create policy "Owner accède à ses notes de frais" on expenses
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

-- ------------------------------------------------------------
-- Factures récurrentes (modèles générant des factures périodiquement)
-- ------------------------------------------------------------
create table if not exists recurring_invoices (
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

alter table recurring_invoices enable row level security;
create policy "Owner accède à ses factures récurrentes" on recurring_invoices
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));
