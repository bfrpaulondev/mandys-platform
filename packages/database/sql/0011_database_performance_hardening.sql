-- Database performance hardening for Mandy's tenant-owned tables.
-- Keep this scoped to the mandys schema; this Supabase project also contains
-- unrelated public-schema tables that must not be altered by Mandy's migrations.

-- current_setting() is transaction-stable. Wrapping it in a scalar SELECT lets
-- PostgreSQL evaluate the tenant id once per statement rather than once per row.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename
    from pg_policies
    where schemaname = 'mandys'
      and policyname = 'tenant_isolation'
      and cmd = 'ALL'
      and qual = '(organization_id = current_setting(''app.organization_id''::text, true))'
      and with_check = '(organization_id = current_setting(''app.organization_id''::text, true))'
  loop
    execute format(
      'alter policy tenant_isolation on mandys.%I using (organization_id = (select current_setting(''app.organization_id'', true))) with check (organization_id = (select current_setting(''app.organization_id'', true)))',
      policy_row.tablename
    );
  end loop;
end
$$;

-- Cover foreign-key columns used by deletes, joins and integrity checks.
create index if not exists dining_areas_location_id_idx on mandys.dining_areas(location_id);
create index if not exists event_leads_customer_id_idx on mandys.event_leads(customer_id);
create index if not exists event_leads_location_id_idx on mandys.event_leads(location_id);
create index if not exists invitation_inviter_id_idx on mandys.invitation(inviter_id);
create index if not exists menu_categories_menu_id_idx on mandys.menu_categories(menu_id);
create index if not exists menu_item_allergens_allergen_id_idx on mandys.menu_item_allergens(allergen_id);
create index if not exists menu_items_category_id_idx on mandys.menu_items(category_id);
create index if not exists menus_location_id_idx on mandys.menus(location_id);
create index if not exists notification_receipts_user_id_idx on mandys.notification_receipts(user_id);
create index if not exists order_items_menu_item_id_idx on mandys.order_items(menu_item_id);
create index if not exists order_items_order_id_idx on mandys.order_items(order_id);
create index if not exists orders_customer_id_idx on mandys.orders(customer_id);
create index if not exists orders_location_id_idx on mandys.orders(location_id);
create index if not exists recipe_ingredients_ingredient_id_idx on mandys.recipe_ingredients(ingredient_id);
create index if not exists recipes_menu_item_id_idx on mandys.recipes(menu_item_id);
create index if not exists reservation_waitlist_customer_id_idx on mandys.reservation_waitlist(customer_id);
create index if not exists reservation_waitlist_location_id_idx on mandys.reservation_waitlist(location_id);
create index if not exists reservations_customer_id_idx on mandys.reservations(customer_id);
create index if not exists reservations_dining_area_id_idx on mandys.reservations(dining_area_id);
create index if not exists reservations_location_id_idx on mandys.reservations(location_id);
create index if not exists reservations_table_id_idx on mandys.reservations(table_id);
create index if not exists restaurant_profiles_location_id_idx on mandys.restaurant_profiles(location_id);
create index if not exists restaurant_tables_location_id_idx on mandys.restaurant_tables(location_id);
create index if not exists stock_movements_actor_user_id_idx on mandys.stock_movements(actor_user_id);
create index if not exists stock_movements_ingredient_id_idx on mandys.stock_movements(ingredient_id);
create index if not exists stock_movements_supplier_id_idx on mandys.stock_movements(supplier_id);
create index if not exists tenant_subscriptions_plan_key_idx on mandys.tenant_subscriptions(plan_key);
