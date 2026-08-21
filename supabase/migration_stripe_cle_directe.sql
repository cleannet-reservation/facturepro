alter table businesses add column if not exists stripe_secret_key text;
alter table businesses add column if not exists stripe_webhook_secret text;
