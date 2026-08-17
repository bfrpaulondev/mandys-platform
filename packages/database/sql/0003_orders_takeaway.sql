-- Mandy's Orders: first operational slice for takeaway / pay-at-pickup.
-- Additive migration; payment capture and delivery are separate later modules.

set search_path to mandys, public;

create sequence if not exists mandys.order_number_seq start with 1001;

create table if not exists mandys.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid not null references mandys.locations(id) on delete restrict,
  customer_id uuid references mandys.customers(id) on delete set null,
  order_number bigint not null default nextval('mandys.order_number_seq'),
  status text not null default 'pending',
  fulfillment_type text not null default 'pickup',
  payment_method text not null default 'pay_at_pickup',
  currency char(3) not null default 'EUR',
  subtotal_cents integer not null default 0,
  total_cents integer not null default 0,
  scheduled_for timestamptz,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  notes text,
  source text not null default 'storefront',
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (status in ('pending','accepted','preparing','ready','completed','cancelled')),
  constraint orders_fulfillment_check check (fulfillment_type in ('pickup')),
  constraint orders_payment_method_check check (payment_method in ('pay_at_pickup')),
  constraint orders_amounts_check check (subtotal_cents >= 0 and total_cents >= 0),
  constraint orders_guest_name_check check (char_length(trim(guest_name)) between 2 and 160),
  constraint orders_org_number_uidx unique (organization_id, order_number)
);

create index if not exists orders_org_status_created_idx
  on mandys.orders (organization_id, status, created_at desc);
create index if not exists orders_org_location_created_idx
  on mandys.orders (organization_id, location_id, created_at desc);
create index if not exists orders_org_customer_idx
  on mandys.orders (organization_id, customer_id, created_at desc);

create table if not exists mandys.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  order_id uuid not null references mandys.orders(id) on delete cascade,
  menu_item_id uuid references mandys.menu_items(id) on delete set null,
  item_name text not null,
  unit_price_cents integer not null,
  quantity integer not null,
  line_total_cents integer not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint order_items_price_check check (unit_price_cents >= 0 and line_total_cents >= 0),
  constraint order_items_quantity_check check (quantity between 1 and 100),
  constraint order_items_name_check check (char_length(trim(item_name)) between 1 and 200)
);

create index if not exists order_items_org_order_idx
  on mandys.order_items (organization_id, order_id, created_at);

alter table mandys.orders enable row level security;
alter table mandys.orders force row level security;
drop policy if exists tenant_isolation on mandys.orders;
create policy tenant_isolation on mandys.orders
  using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

alter table mandys.order_items enable row level security;
alter table mandys.order_items force row level security;
drop policy if exists tenant_isolation on mandys.order_items;
create policy tenant_isolation on mandys.order_items
  using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

revoke all on mandys.orders from anon, authenticated;
revoke all on mandys.order_items from anon, authenticated;
