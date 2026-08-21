alter table businesses add column if not exists sap_eligible boolean default false;
alter table businesses add column if not exists sap_agrement_number text;
alter table quotes add column if not exists tax_credit_eligible boolean default false;
alter table invoices add column if not exists invoice_type text default 'standalone'
  check (invoice_type in ('standalone', 'acompte', 'solde'));
alter table invoices add column if not exists tax_credit_eligible boolean default false;
create index if not exists idx_invoices_quote_id on invoices(quote_id);
