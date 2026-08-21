alter table invoices add column if not exists last_reminder_sent_at timestamptz;
alter table invoices add column if not exists reminder_count int default 0;
