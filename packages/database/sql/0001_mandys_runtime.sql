-- Mandy's V0.1 runtime schema.
-- This intentionally uses a dedicated `mandys` schema so the platform can
-- coexist safely with other applications in the same PostgreSQL project.

create schema if not exists mandys;
set search_path to mandys, public;

create type mandys.locale_code as enum ('pt-PT', 'pt-BR', 'en', 'es');
create type mandys.entitlement_status as enum ('enabled', 'disabled', 'trial');
create type mandys.reservation_status as enum (
  'pending',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'no_show'
);
create type mandys.event_lead_status as enum (
  'new',
  'contacted',
  'proposal_sent',
  'deposit_pending',
  'confirmed',
  'completed',
  'lost'
);

-- Better Auth core + Organization plugin. These tables intentionally live in
-- the same isolated schema but are not tenant-RLS protected because auth must
-- resolve the session before Mandy's can derive an active organization.
create table mandys."user" (
  id text primary key,
  name text not null,
  email text not null,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_email_uidx on mandys."user" (email);

create table mandys.session (
  id text primary key,
  expires_at timestamptz not null,
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references mandys."user"(id) on delete cascade,
  active_organization_id text,
  active_team_id text
);
create unique index session_token_uidx on mandys.session (token);
create index session_user_idx on mandys.session (user_id);

create table mandys.account (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references mandys."user"(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index account_provider_account_uidx on mandys.account (provider_id, account_id);
create index account_user_idx on mandys.account (user_id);

create table mandys.verification (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_identifier_idx on mandys.verification (identifier);

create table mandys.organization (
  id text primary key,
  name text not null,
  slug text not null,
  logo text,
  created_at timestamptz not null default now(),
  metadata text
);
create unique index organization_slug_uidx on mandys.organization (slug);

create table mandys.member (
  id text primary key,
  organization_id text not null references mandys.organization(id) on delete cascade,
  user_id text not null references mandys."user"(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now()
);
create unique index member_org_user_uidx on mandys.member (organization_id, user_id);
create index member_user_idx on mandys.member (user_id);

create table mandys.invitation (
  id text primary key,
  organization_id text not null references mandys.organization(id) on delete cascade,
  email text not null,
  role text,
  status text not null default 'pending',
  expires_at timestamptz not null,
  inviter_id text not null references mandys."user"(id) on delete cascade,
  team_id text,
  created_at timestamptz not null default now()
);
create index invitation_org_idx on mandys.invitation (organization_id);
create index invitation_email_idx on mandys.invitation (email);

-- Tenant/business data.
create table mandys.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  default_locale mandys.locale_code not null default 'pt-PT',
  enabled_locales jsonb not null default '["pt-PT","en","es"]'::jsonb,
  timezone text not null default 'Europe/Lisbon',
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index tenant_settings_organization_uidx on mandys.tenant_settings (organization_id);

create table mandys.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  name text not null,
  slug text not null,
  email text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  postal_code text,
  city text,
  country_code text not null default 'PT',
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index locations_org_slug_uidx on mandys.locations (organization_id, slug);
create index locations_org_idx on mandys.locations (organization_id);

create table mandys.restaurant_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid references mandys.locations(id) on delete cascade,
  public_name text not null,
  legal_name text,
  description text,
  logo_url text,
  cover_url text,
  contact_email text,
  contact_phone text,
  reservation_duration_minutes integer not null default 90,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index restaurant_profiles_org_idx on mandys.restaurant_profiles (organization_id);

create table mandys.opening_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid not null references mandys.locations(id) on delete cascade,
  weekday integer not null,
  opens_at text,
  closes_at text,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index opening_hours_location_weekday_uidx on mandys.opening_hours (location_id, weekday);
create index opening_hours_org_location_idx on mandys.opening_hours (organization_id, location_id);

create table mandys.domains (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  hostname text not null,
  verified_at timestamptz,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index domains_hostname_uidx on mandys.domains (hostname);
create index domains_org_idx on mandys.domains (organization_id);

create table mandys.module_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  module_key text not null,
  status mandys.entitlement_status not null default 'disabled',
  plan text,
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index module_entitlements_org_module_uidx on mandys.module_entitlements (organization_id, module_key);

create table mandys.theme_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  theme_key text not null,
  status mandys.entitlement_status not null default 'disabled',
  license_type text not null default 'included',
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index theme_entitlements_org_theme_uidx on mandys.theme_entitlements (organization_id, theme_key);

create table mandys.tenant_theme_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  theme_key text not null default 'minimal',
  variant text not null default 'light',
  tokens jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index tenant_theme_settings_org_uidx on mandys.tenant_theme_settings (organization_id);

create table mandys.menus (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid references mandys.locations(id) on delete cascade,
  internal_name text not null,
  slug text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index menus_org_slug_uidx on mandys.menus (organization_id, slug);
create index menus_org_location_idx on mandys.menus (organization_id, location_id);

create table mandys.menu_translations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  menu_id uuid not null references mandys.menus(id) on delete cascade,
  locale mandys.locale_code not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index menu_translations_menu_locale_uidx on mandys.menu_translations (menu_id, locale);
create index menu_translations_org_idx on mandys.menu_translations (organization_id);

create table mandys.menu_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  menu_id uuid not null references mandys.menus(id) on delete cascade,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_categories_org_menu_idx on mandys.menu_categories (organization_id, menu_id);

create table mandys.menu_category_translations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  category_id uuid not null references mandys.menu_categories(id) on delete cascade,
  locale mandys.locale_code not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index menu_category_translations_locale_uidx on mandys.menu_category_translations (category_id, locale);

create table mandys.menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  category_id uuid not null references mandys.menu_categories(id) on delete cascade,
  sku text,
  price_cents integer not null,
  image_url text,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_org_category_idx on mandys.menu_items (organization_id, category_id);
create unique index menu_items_org_sku_uidx on mandys.menu_items (organization_id, sku);

create table mandys.menu_item_translations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  menu_item_id uuid not null references mandys.menu_items(id) on delete cascade,
  locale mandys.locale_code not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index menu_item_translations_item_locale_uidx on mandys.menu_item_translations (menu_item_id, locale);
create index menu_item_translations_org_idx on mandys.menu_item_translations (organization_id);

create table mandys.allergens (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index allergens_org_code_uidx on mandys.allergens (organization_id, code);

create table mandys.menu_item_allergens (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  menu_item_id uuid not null references mandys.menu_items(id) on delete cascade,
  allergen_id uuid not null references mandys.allergens(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index menu_item_allergens_uidx on mandys.menu_item_allergens (menu_item_id, allergen_id);

create table mandys.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  preferred_locale mandys.locale_code,
  notes text,
  marketing_consent_at timestamptz,
  marketing_consent_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_org_email_idx on mandys.customers (organization_id, email);
create index customers_org_phone_idx on mandys.customers (organization_id, phone);

create table mandys.dining_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid not null references mandys.locations(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dining_areas_org_location_idx on mandys.dining_areas (organization_id, location_id);

create table mandys.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid not null references mandys.locations(id) on delete cascade,
  dining_area_id uuid not null references mandys.dining_areas(id) on delete cascade,
  name text not null,
  min_seats integer not null default 1,
  max_seats integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index restaurant_tables_area_name_uidx on mandys.restaurant_tables (dining_area_id, name);
create index restaurant_tables_org_location_idx on mandys.restaurant_tables (organization_id, location_id);

create table mandys.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid not null references mandys.locations(id) on delete restrict,
  customer_id uuid references mandys.customers(id) on delete set null,
  dining_area_id uuid references mandys.dining_areas(id) on delete set null,
  table_id uuid references mandys.restaurant_tables(id) on delete set null,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  party_size integer not null,
  status mandys.reservation_status not null default 'pending',
  notes text,
  source text not null default 'direct',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reservations_org_start_idx on mandys.reservations (organization_id, starts_at);
create index reservations_org_location_start_idx on mandys.reservations (organization_id, location_id, starts_at);
create index reservations_org_status_start_idx on mandys.reservations (organization_id, status, starts_at);

create table mandys.event_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid references mandys.locations(id) on delete set null,
  customer_id uuid references mandys.customers(id) on delete set null,
  status mandys.event_lead_status not null default 'new',
  event_type text not null,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  event_at timestamptz,
  party_size integer,
  budget_min_cents integer,
  budget_max_cents integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_leads_org_status_idx on mandys.event_leads (organization_id, status);
create index event_leads_org_event_idx on mandys.event_leads (organization_id, event_at);

create table mandys.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  actor_user_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  request_id text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on mandys.audit_logs (organization_id, created_at);
create index audit_logs_org_entity_idx on mandys.audit_logs (organization_id, entity_type, entity_id);

-- RLS defense-in-depth for tenant-owned business data. `domains` is excluded
-- because verified hostname -> organization resolution happens before tenant
-- context is available. Auth tables are also excluded intentionally.
do $$
declare
  table_name text;
  tenant_tables text[] := array[
    'tenant_settings',
    'locations',
    'restaurant_profiles',
    'opening_hours',
    'module_entitlements',
    'theme_entitlements',
    'tenant_theme_settings',
    'menus',
    'menu_translations',
    'menu_categories',
    'menu_category_translations',
    'menu_items',
    'menu_item_translations',
    'allergens',
    'menu_item_allergens',
    'customers',
    'dining_areas',
    'restaurant_tables',
    'reservations',
    'event_leads',
    'audit_logs'
  ];
begin
  foreach table_name in array tenant_tables loop
    execute format('alter table mandys.%I enable row level security', table_name);
    execute format('alter table mandys.%I force row level security', table_name);
    execute format(
      'create policy tenant_isolation on mandys.%I using (organization_id = current_setting(''app.organization_id'', true)) with check (organization_id = current_setting(''app.organization_id'', true))',
      table_name
    );
  end loop;
end $$;

-- The Mandy's schema is backend-only. Do not expose it through PostgREST.
revoke all on schema mandys from anon, authenticated;
revoke all on all tables in schema mandys from anon, authenticated;
