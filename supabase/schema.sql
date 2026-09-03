-- ============================================================
-- FacturePro — Schéma Supabase complet (tout-en-un)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Entreprises
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
  stripe_secret_key text,
  stripe_webhook_secret text,
  sap_eligible boolean default false,
  sap_agrement_number text,
  app_name text default 'FacturePro',
  brand_color text default '#22D3EE',
  subscription_status text default 'trial' check (subscription_status in ('trial', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz default (now() + interval '7 days'),
  stripe_customer_id text,
  stripe_subscription_id text,
  access_enabled boolean default true,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. Clients
-- ------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  client_type text default 'particulier' check (client_type in ('particulier', 'professionnel')),
  company_name text,
  tva_number text,
  siren_siret text,
  naf_code text,
  language text default 'fr' check (language in ('fr', 'en')),
  address text,
  address_complement text,
  postal_code text,
  city text,
  website text,
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
  discount_type text default 'none' check (discount_type in ('none', 'percent', 'amount')),
  discount_value numeric(10,2) default 0,
  discount_amount numeric(10,2) default 0,
  notes text,
  accepted_at timestamptz,
  accepted_by_name text,
  tax_credit_eligible boolean default false,
  public_token uuid default gen_random_uuid(),
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
  discount_type text default 'none' check (discount_type in ('none', 'percent', 'amount')),
  discount_value numeric(10,2) default 0,
  discount_amount numeric(10,2) default 0,
  deposit_requested numeric(10,2) default 0,
  deposit_paid numeric(10,2) default 0,
  tax_credit_eligible boolean default false,
  stripe_payment_link_url text,
  notes text,
  public_token uuid default gen_random_uuid(),
  last_reminder_sent_at timestamptz,
  reminder_count int default 0,
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
-- 5. Catalogue de prestations
-- ------------------------------------------------------------
create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  unit_price numeric(10,2) not null default 0,
  tva_rate numeric(4,2) not null default 20,
  created_at timestamptz default now()
);

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

-- ------------------------------------------------------------
-- 7. Super admin plateforme
-- ------------------------------------------------------------
create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 8. Row Level Security
-- ------------------------------------------------------------
alter table businesses enable row level security;
alter table clients enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table services enable row level security;
alter table purchases enable row level security;
alter table expenses enable row level security;
alter table recurring_invoices enable row level security;
alter table platform_admins enable row level security;

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

create policy "Owner accède à son catalogue" on services
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Owner accède à ses achats" on purchases
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Owner accède à ses notes de frais" on expenses
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Owner accède à ses factures récurrentes" on recurring_invoices
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Un utilisateur vérifie son propre statut admin" on platform_admins
  for select using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 9. Stockage du logo
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "Owner upload son logo"
on storage.objects for insert
with check (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owner met à jour son logo"
on storage.objects for update
using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owner supprime son logo"
on storage.objects for delete
using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Logos visibles publiquement"
on storage.objects for select
using (bucket_id = 'logos');

-- ------------------------------------------------------------
-- NOTE SÉCURITÉ IMPORTANTE :
-- La colonne businesses.stripe_secret_key ne doit JAMAIS être lue
-- depuis le frontend directement — elle n'est utilisée que côté
-- serveur (fonctions api/) via la clé de service Supabase.
--
-- DERNIÈRE ÉTAPE APRÈS AVOIR LANCÉ CE SCRIPT :
-- déclare-toi super admin en remplaçant TON_USER_ID ci-dessous par
-- ton identifiant (Authentication → Users → copie le "User UID") :
-- insert into platform_admins (user_id) values ('TON_USER_ID');
-- ------------------------------------------------------------
