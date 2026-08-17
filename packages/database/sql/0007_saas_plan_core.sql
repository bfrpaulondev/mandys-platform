-- Mandy's SaaS commercial core. Pricing/provider checkout remains intentionally unset until commercial pricing is decided.
set search_path to mandys, public;

create table if not exists mandys.saas_plans (
  plan_key text primary key,
  display_name text not null,
  position integer not null default 0,
  monthly_price_cents integer,
  annual_price_cents integer,
  currency char(3) not null default 'EUR',
  is_public boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_plans_key_check check (plan_key in ('start','grow','operate','intelligence','multi')),
  constraint saas_plans_price_check check ((monthly_price_cents is null or monthly_price_cents >= 0) and (annual_price_cents is null or annual_price_cents >= 0))
);

create table if not exists mandys.saas_plan_modules (
  plan_key text not null references mandys.saas_plans(plan_key) on delete cascade,
  module_key mandys.module_key not null,
  created_at timestamptz not null default now(),
  primary key (plan_key,module_key)
);

create table if not exists mandys.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references mandys.organization(id) on delete cascade,
  plan_key text not null references mandys.saas_plans(plan_key),
  status text not null default 'trialing',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_subscriptions_status_check check (status in ('trialing','active','past_due','paused','cancelled','incomplete')),
  constraint tenant_subscriptions_provider_check check (provider is null or provider in ('stripe')),
  constraint tenant_subscriptions_org_uidx unique (organization_id)
);
create index if not exists tenant_subscriptions_status_idx on mandys.tenant_subscriptions (status,trial_ends_at,current_period_ends_at);

create table if not exists mandys.subscription_events (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references mandys.organization(id) on delete cascade,
  event_type text not null,
  provider text,
  provider_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists subscription_events_provider_uidx on mandys.subscription_events (provider,provider_event_id) where provider_event_id is not null;
create index if not exists subscription_events_org_created_idx on mandys.subscription_events (organization_id,created_at desc);

insert into mandys.saas_plans (plan_key,display_name,position,is_public,is_active) values
  ('start','Start',10,false,true),
  ('grow','Grow',20,false,true),
  ('operate','Operate',30,false,true),
  ('intelligence','Intelligence',40,false,true),
  ('multi','Multi',50,false,true)
on conflict (plan_key) do update set display_name=excluded.display_name,position=excluded.position,is_active=true;

insert into mandys.saas_plan_modules (plan_key,module_key) values
  ('start','core'),('start','menu'),('start','reservations'),
  ('grow','core'),('grow','menu'),('grow','reservations'),('grow','crm'),('grow','events'),
  ('operate','core'),('operate','menu'),('operate','reservations'),('operate','crm'),('operate','events'),('operate','orders'),('operate','stock'),('operate','analytics'),
  ('intelligence','core'),('intelligence','menu'),('intelligence','reservations'),('intelligence','crm'),('intelligence','events'),('intelligence','orders'),('intelligence','stock'),('intelligence','analytics'),('intelligence','ai'),
  ('multi','core'),('multi','menu'),('multi','reservations'),('multi','crm'),('multi','events'),('multi','orders'),('multi','stock'),('multi','analytics'),('multi','ai'),('multi','multi_location')
on conflict do nothing;

insert into mandys.tenant_subscriptions (organization_id,plan_key,status,trial_started_at,trial_ends_at)
select id,'grow','trialing',now(),now()+interval '14 days'
from mandys.organization o
where not exists (select 1 from mandys.tenant_subscriptions s where s.organization_id=o.id);

create or replace function mandys.create_default_subscription()
returns trigger
language plpgsql
security definer
set search_path=mandys,public
as $$
begin
  insert into mandys.tenant_subscriptions (organization_id,plan_key,status,trial_started_at,trial_ends_at)
  values (new.id,'grow','trialing',now(),now()+interval '14 days')
  on conflict (organization_id) do nothing;
  return new;
end;
$$;
revoke all on function mandys.create_default_subscription() from public;
drop trigger if exists organization_default_subscription on mandys.organization;
create trigger organization_default_subscription after insert on mandys.organization for each row execute function mandys.create_default_subscription();

alter table mandys.tenant_subscriptions enable row level security;
alter table mandys.tenant_subscriptions force row level security;
drop policy if exists tenant_isolation on mandys.tenant_subscriptions;
create policy tenant_isolation on mandys.tenant_subscriptions using (organization_id=current_setting('app.organization_id',true)) with check (organization_id=current_setting('app.organization_id',true));

alter table mandys.subscription_events enable row level security;
alter table mandys.subscription_events force row level security;
drop policy if exists tenant_isolation on mandys.subscription_events;
create policy tenant_isolation on mandys.subscription_events using (organization_id=current_setting('app.organization_id',true)) with check (organization_id=current_setting('app.organization_id',true));

revoke all on mandys.saas_plans from anon, authenticated;
revoke all on mandys.saas_plan_modules from anon, authenticated;
revoke all on mandys.tenant_subscriptions from anon, authenticated;
revoke all on mandys.subscription_events from anon, authenticated;
