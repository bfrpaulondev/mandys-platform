-- Mandy's V0.1 initial PostgreSQL/Supabase schema.
-- Server-side Fastify access uses a direct PostgreSQL connection.
-- Public Data API access is intentionally revoked; RLS remains enabled as defense in depth.

DO $$ BEGIN
  CREATE TYPE locale_code AS ENUM ('pt-PT', 'pt-BR', 'en', 'es');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE entitlement_status AS ENUM ('enabled', 'disabled', 'trial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE event_lead_status AS ENUM ('new', 'contacted', 'proposal_sent', 'deposit_pending', 'confirmed', 'completed', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  default_locale locale_code NOT NULL DEFAULT 'pt-PT', enabled_locales jsonb NOT NULL DEFAULT '["pt-PT","en","es"]'::jsonb,
  timezone text NOT NULL DEFAULT 'Europe/Lisbon', currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_settings_organization_uidx ON tenant_settings (organization_id);

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, name text NOT NULL, slug text NOT NULL,
  email text, phone text, address_line_1 text, address_line_2 text, postal_code text, city text,
  country_code text NOT NULL DEFAULT 'PT', latitude numeric(9,6), longitude numeric(9,6), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS locations_org_slug_uidx ON locations (organization_id, slug);
CREATE INDEX IF NOT EXISTS locations_org_idx ON locations (organization_id);

CREATE TABLE IF NOT EXISTS restaurant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE, public_name text NOT NULL, legal_name text, description text,
  logo_url text, cover_url text, contact_email text, contact_phone text, reservation_duration_minutes integer NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restaurant_profiles_org_idx ON restaurant_profiles (organization_id);

CREATE TABLE IF NOT EXISTS opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE, weekday integer NOT NULL,
  opens_at text, closes_at text, is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS opening_hours_location_weekday_uidx ON opening_hours (location_id, weekday);
CREATE INDEX IF NOT EXISTS opening_hours_org_location_idx ON opening_hours (organization_id, location_id);

CREATE TABLE IF NOT EXISTS domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, hostname text NOT NULL,
  verified_at timestamptz, is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS domains_hostname_uidx ON domains (hostname);
CREATE INDEX IF NOT EXISTS domains_org_idx ON domains (organization_id);

CREATE TABLE IF NOT EXISTS module_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, module_key text NOT NULL,
  status entitlement_status NOT NULL DEFAULT 'disabled', plan text, activated_at timestamptz, expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_entitlements_org_module_uidx ON module_entitlements (organization_id, module_key);

CREATE TABLE IF NOT EXISTS theme_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, theme_key text NOT NULL,
  status entitlement_status NOT NULL DEFAULT 'disabled', license_type text NOT NULL DEFAULT 'included', purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS theme_entitlements_org_theme_uidx ON theme_entitlements (organization_id, theme_key);

CREATE TABLE IF NOT EXISTS tenant_theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, theme_key text NOT NULL DEFAULT 'minimal',
  variant text NOT NULL DEFAULT 'light', tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_theme_settings_org_uidx ON tenant_theme_settings (organization_id);

CREATE TABLE IF NOT EXISTS menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE, internal_name text NOT NULL, slug text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS menus_org_slug_uidx ON menus (organization_id, slug);
CREATE INDEX IF NOT EXISTS menus_org_location_idx ON menus (organization_id, location_id);

CREATE TABLE IF NOT EXISTS menu_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE, locale locale_code NOT NULL, name text NOT NULL, description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_translations_menu_locale_uidx ON menu_translations (menu_id, locale);
CREATE INDEX IF NOT EXISTS menu_translations_org_idx ON menu_translations (organization_id);

CREATE TABLE IF NOT EXISTS menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE, sort_order integer NOT NULL DEFAULT 0, is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS menu_categories_org_menu_idx ON menu_categories (organization_id, menu_id);

CREATE TABLE IF NOT EXISTS menu_category_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  category_id uuid NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE, locale locale_code NOT NULL, name text NOT NULL, description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_category_translations_locale_uidx ON menu_category_translations (category_id, locale);

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  category_id uuid NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE, sku text, price_cents integer NOT NULL,
  image_url text, is_available boolean NOT NULL DEFAULT true, is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS menu_items_org_category_idx ON menu_items (organization_id, category_id);
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_org_sku_uidx ON menu_items (organization_id, sku);

CREATE TABLE IF NOT EXISTS menu_item_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE, locale locale_code NOT NULL, name text NOT NULL, description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_item_translations_item_locale_uidx ON menu_item_translations (menu_item_id, locale);
CREATE INDEX IF NOT EXISTS menu_item_translations_org_idx ON menu_item_translations (organization_id);

CREATE TABLE IF NOT EXISTS allergens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, code text NOT NULL, name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS allergens_org_code_uidx ON allergens (organization_id, code);

CREATE TABLE IF NOT EXISTS menu_item_allergens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  allergen_id uuid NOT NULL REFERENCES allergens(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_item_allergens_uidx ON menu_item_allergens (menu_item_id, allergen_id);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, first_name text NOT NULL, last_name text,
  email text, phone text, preferred_locale locale_code, notes text, marketing_consent_at timestamptz, marketing_consent_source text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_org_email_idx ON customers (organization_id, email);
CREATE INDEX IF NOT EXISTS customers_org_phone_idx ON customers (organization_id, phone);

CREATE TABLE IF NOT EXISTS dining_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE, name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dining_areas_org_location_idx ON dining_areas (organization_id, location_id);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  dining_area_id uuid NOT NULL REFERENCES dining_areas(id) ON DELETE CASCADE, name text NOT NULL,
  min_seats integer NOT NULL DEFAULT 1, max_seats integer NOT NULL, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_tables_area_name_uidx ON restaurant_tables (dining_area_id, name);
CREATE INDEX IF NOT EXISTS restaurant_tables_org_location_idx ON restaurant_tables (organization_id, location_id);

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  dining_area_id uuid REFERENCES dining_areas(id) ON DELETE SET NULL,
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  guest_name text NOT NULL, guest_email text, guest_phone text,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, party_size integer NOT NULL,
  status reservation_status NOT NULL DEFAULT 'pending', notes text, source text NOT NULL DEFAULT 'direct',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_time_window_check CHECK (ends_at > starts_at),
  CONSTRAINT reservations_party_size_check CHECK (party_size > 0)
);
CREATE INDEX IF NOT EXISTS reservations_org_start_idx ON reservations (organization_id, starts_at);
CREATE INDEX IF NOT EXISTS reservations_org_location_start_idx ON reservations (organization_id, location_id, starts_at);
CREATE INDEX IF NOT EXISTS reservations_org_status_start_idx ON reservations (organization_id, status, starts_at);

CREATE TABLE IF NOT EXISTS event_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL, customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status event_lead_status NOT NULL DEFAULT 'new', event_type text NOT NULL, contact_name text NOT NULL,
  contact_email text, contact_phone text, event_at timestamptz, party_size integer,
  budget_min_cents integer, budget_max_cents integer, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_leads_party_size_check CHECK (party_size IS NULL OR party_size > 0),
  CONSTRAINT event_leads_budget_check CHECK (budget_min_cents IS NULL OR budget_max_cents IS NULL OR budget_max_cents >= budget_min_cents)
);
CREATE INDEX IF NOT EXISTS event_leads_org_status_idx ON event_leads (organization_id, status);
CREATE INDEX IF NOT EXISTS event_leads_org_event_idx ON event_leads (organization_id, event_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, actor_user_id text,
  action text NOT NULL, entity_type text NOT NULL, entity_id text, request_id text, ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx ON audit_logs (organization_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_org_entity_idx ON audit_logs (organization_id, entity_type, entity_id);

DO $$
DECLARE
  table_name text;
  tenant_tables text[] := ARRAY[
    'tenant_settings','locations','restaurant_profiles','opening_hours','domains','module_entitlements',
    'theme_entitlements','tenant_theme_settings','menus','menu_translations','menu_categories',
    'menu_category_translations','menu_items','menu_item_translations','allergens','menu_item_allergens',
    'customers','dining_areas','restaurant_tables','reservations','event_leads','audit_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I USING (organization_id = current_setting(''app.organization_id'', true)) WITH CHECK (organization_id = current_setting(''app.organization_id'', true))',
      table_name
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
  END LOOP;
END $$;
