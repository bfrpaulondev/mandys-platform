-- Mandy's tenant isolation layer.
-- Apply after the Drizzle schema migration. The API must set
-- app.organization_id inside every tenant transaction.

DO $$
DECLARE
  table_name text;
  tenant_tables text[] := ARRAY[
    'tenant_settings',
    'locations',
    'restaurant_profiles',
    'opening_hours',
    'domains',
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
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (organization_id = current_setting(''app.organization_id'', true)) WITH CHECK (organization_id = current_setting(''app.organization_id'', true))',
      table_name
    );
  END LOOP;
END $$;
