-- ============================================================
-- Migration : catalogue de prestations pré-enregistrées
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  unit_price numeric(10,2) not null default 0,
  tva_rate numeric(4,2) not null default 20,
  created_at timestamptz default now()
);

alter table services enable row level security;
create policy "Owner accède à son catalogue" on services
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));
