-- Mandy's Stock: inventory, suppliers and menu recipes.
set search_path to mandys, public;

create table if not exists mandys.ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  name text not null,
  sku text,
  unit text not null,
  current_quantity numeric(14,3) not null default 0,
  reorder_level numeric(14,3) not null default 0,
  average_unit_cost_cents numeric(14,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredients_unit_check check (unit in ('g','kg','ml','l','unit')),
  constraint ingredients_quantity_check check (current_quantity >= 0 and reorder_level >= 0 and average_unit_cost_cents >= 0),
  constraint ingredients_name_check check (char_length(trim(name)) between 1 and 160)
);
create unique index if not exists ingredients_org_sku_uidx on mandys.ingredients (organization_id,lower(sku)) where sku is not null;
create index if not exists ingredients_org_active_name_idx on mandys.ingredients (organization_id,is_active,name);

create table if not exists mandys.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  name text not null,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_name_check check (char_length(trim(name)) between 1 and 200)
);
create index if not exists suppliers_org_active_name_idx on mandys.suppliers (organization_id,is_active,name);

create table if not exists mandys.recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  menu_item_id uuid not null references mandys.menu_items(id) on delete cascade,
  yield_quantity numeric(12,3) not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_yield_check check (yield_quantity > 0),
  constraint recipes_org_menu_item_uidx unique (organization_id,menu_item_id)
);

create table if not exists mandys.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  recipe_id uuid not null references mandys.recipes(id) on delete cascade,
  ingredient_id uuid not null references mandys.ingredients(id) on delete restrict,
  quantity numeric(14,3) not null,
  created_at timestamptz not null default now(),
  constraint recipe_ingredients_quantity_check check (quantity > 0),
  constraint recipe_ingredients_recipe_ingredient_uidx unique (recipe_id,ingredient_id)
);
create index if not exists recipe_ingredients_org_ingredient_idx on mandys.recipe_ingredients (organization_id,ingredient_id);

create table if not exists mandys.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  ingredient_id uuid not null references mandys.ingredients(id) on delete restrict,
  supplier_id uuid references mandys.suppliers(id) on delete set null,
  movement_type text not null,
  quantity_delta numeric(14,3) not null,
  unit_cost_cents numeric(14,4),
  reference text,
  notes text,
  actor_user_id text references mandys."user"(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_movements_type_check check (movement_type in ('purchase','waste','adjustment','recipe_usage','transfer_in','transfer_out')),
  constraint stock_movements_delta_check check (quantity_delta <> 0),
  constraint stock_movements_cost_check check (unit_cost_cents is null or unit_cost_cents >= 0)
);
create index if not exists stock_movements_org_ingredient_created_idx on mandys.stock_movements (organization_id,ingredient_id,created_at desc);
create index if not exists stock_movements_org_type_created_idx on mandys.stock_movements (organization_id,movement_type,created_at desc);

alter table mandys.ingredients enable row level security;
alter table mandys.ingredients force row level security;
drop policy if exists tenant_isolation on mandys.ingredients;
create policy tenant_isolation on mandys.ingredients using (organization_id=current_setting('app.organization_id',true)) with check (organization_id=current_setting('app.organization_id',true));

alter table mandys.suppliers enable row level security;
alter table mandys.suppliers force row level security;
drop policy if exists tenant_isolation on mandys.suppliers;
create policy tenant_isolation on mandys.suppliers using (organization_id=current_setting('app.organization_id',true)) with check (organization_id=current_setting('app.organization_id',true));

alter table mandys.recipes enable row level security;
alter table mandys.recipes force row level security;
drop policy if exists tenant_isolation on mandys.recipes;
create policy tenant_isolation on mandys.recipes using (organization_id=current_setting('app.organization_id',true)) with check (organization_id=current_setting('app.organization_id',true));

alter table mandys.recipe_ingredients enable row level security;
alter table mandys.recipe_ingredients force row level security;
drop policy if exists tenant_isolation on mandys.recipe_ingredients;
create policy tenant_isolation on mandys.recipe_ingredients using (organization_id=current_setting('app.organization_id',true)) with check (organization_id=current_setting('app.organization_id',true));

alter table mandys.stock_movements enable row level security;
alter table mandys.stock_movements force row level security;
drop policy if exists tenant_isolation on mandys.stock_movements;
create policy tenant_isolation on mandys.stock_movements using (organization_id=current_setting('app.organization_id',true)) with check (organization_id=current_setting('app.organization_id',true));

revoke all on mandys.ingredients from anon, authenticated;
revoke all on mandys.suppliers from anon, authenticated;
revoke all on mandys.recipes from anon, authenticated;
revoke all on mandys.recipe_ingredients from anon, authenticated;
revoke all on mandys.stock_movements from anon, authenticated;
