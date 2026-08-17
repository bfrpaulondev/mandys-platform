-- Regional Mandy's pricing is stored by market and remains private until an
-- explicit commercial release. These values are not consumed by checkout while
-- is_public=false.
set search_path to mandys, public;

create table if not exists mandys.saas_plan_prices (
  plan_key text not null references mandys.saas_plans(plan_key) on delete cascade,
  country_code text not null,
  currency text not null,
  monthly_price_minor integer not null,
  annual_price_minor integer not null,
  included_staff integer not null,
  extra_staff_monthly_minor integer not null,
  is_public boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_key, country_code),
  constraint saas_plan_prices_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint saas_plan_prices_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint saas_plan_prices_monthly_check check (monthly_price_minor >= 0),
  constraint saas_plan_prices_annual_check check (annual_price_minor >= 0),
  constraint saas_plan_prices_extra_staff_check check (extra_staff_monthly_minor >= 0),
  constraint saas_plan_prices_staff_check check (included_staff between 0 and 10000)
);

create index if not exists saas_plan_prices_market_idx
  on mandys.saas_plan_prices (country_code, is_active, is_public, plan_key);

revoke all on mandys.saas_plan_prices from anon, authenticated;

comment on table mandys.saas_plan_prices is
  'Country-specific Mandy''s SaaS prices. All rows stay private until explicitly approved for public checkout.';

insert into mandys.saas_plan_prices
  (plan_key, country_code, currency, monthly_price_minor, annual_price_minor, included_staff, extra_staff_monthly_minor, is_public)
values
  ('start','PT','EUR',3900,39000,5,390,false),
  ('grow','PT','EUR',6900,69000,15,390,false),
  ('operate','PT','EUR',10900,109000,30,390,false),
  ('intelligence','PT','EUR',14900,149000,30,390,false),
  ('multi','PT','EUR',19900,199000,50,390,false),
  ('start','ES','EUR',3900,39000,5,390,false),
  ('grow','ES','EUR',6900,69000,15,390,false),
  ('operate','ES','EUR',10900,109000,30,390,false),
  ('intelligence','ES','EUR',14900,149000,30,390,false),
  ('multi','ES','EUR',19900,199000,50,390,false),
  ('start','US','USD',4900,49000,5,490,false),
  ('grow','US','USD',8900,89000,15,490,false),
  ('operate','US','USD',14900,149000,30,490,false),
  ('intelligence','US','USD',19900,199000,30,490,false),
  ('multi','US','USD',29900,299000,50,490,false),
  ('start','BR','BRL',7900,79000,5,990,false),
  ('grow','BR','BRL',14900,149000,15,990,false),
  ('operate','BR','BRL',24900,249000,30,990,false),
  ('intelligence','BR','BRL',34900,349000,30,990,false),
  ('multi','BR','BRL',49900,499000,50,990,false),
  ('start','IN','INR',49900,499000,5,4900,false),
  ('grow','IN','INR',89900,899000,15,4900,false),
  ('operate','IN','INR',149900,1499000,30,4900,false),
  ('intelligence','IN','INR',219900,2199000,30,4900,false),
  ('multi','IN','INR',349900,3499000,50,4900,false),
  ('start','GB','GBP',3500,35000,5,350,false),
  ('grow','GB','GBP',5900,59000,15,350,false),
  ('operate','GB','GBP',9500,95000,30,350,false),
  ('intelligence','GB','GBP',12900,129000,30,350,false),
  ('multi','GB','GBP',17900,179000,50,350,false),
  ('start','CA','CAD',4900,49000,5,450,false),
  ('grow','CA','CAD',7900,79000,15,450,false),
  ('operate','CA','CAD',12900,129000,30,450,false),
  ('intelligence','CA','CAD',17900,179000,30,450,false),
  ('multi','CA','CAD',24900,249000,50,450,false),
  ('start','AU','AUD',5900,59000,5,500,false),
  ('grow','AU','AUD',9900,99000,15,500,false),
  ('operate','AU','AUD',15900,159000,30,500,false),
  ('intelligence','AU','AUD',21900,219000,30,500,false),
  ('multi','AU','AUD',29900,299000,50,500,false),
  ('start','MX','MXN',39900,399000,5,4900,false),
  ('grow','MX','MXN',69900,699000,15,4900,false),
  ('operate','MX','MXN',99900,999000,30,4900,false),
  ('intelligence','MX','MXN',129900,1299000,30,4900,false),
  ('multi','MX','MXN',179900,1799000,50,4900,false)
on conflict (plan_key, country_code) do update set
  currency=excluded.currency,
  monthly_price_minor=excluded.monthly_price_minor,
  annual_price_minor=excluded.annual_price_minor,
  included_staff=excluded.included_staff,
  extra_staff_monthly_minor=excluded.extra_staff_monthly_minor,
  is_public=false,
  is_active=true,
  updated_at=now();
