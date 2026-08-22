alter table businesses add column if not exists subscription_status text default 'trial'
  check (subscription_status in ('trial', 'active', 'past_due', 'canceled'));
alter table businesses add column if not exists trial_ends_at timestamptz default (now() + interval '7 days');
alter table businesses add column if not exists stripe_customer_id text;
alter table businesses add column if not exists stripe_subscription_id text;
alter table businesses add column if not exists access_enabled boolean default true;

create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table platform_admins enable row level security;

create policy "Un utilisateur vérifie son propre statut admin" on platform_admins
  for select using (user_id = auth.uid());

-- insert into platform_admins (user_id) values ('TON-USER-UID');
