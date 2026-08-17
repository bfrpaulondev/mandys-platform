import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const projectUrl = "https://dbfmjdissqsdhxhmqkqp.supabase.co";
const authSessionUrl = `${projectUrl}/functions/v1/mandys-auth/api/auth/get-session`;
const connectionString = Deno.env.get("SUPABASE_DB_URL");
if (!connectionString) throw new Error("SUPABASE_DB_URL is required");

const sql = postgres(connectionString, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: { application_name: "mandys-data-protection-edge", search_path: "mandys,public" },
});

type Context = { userId: string; organizationId: string; role: string; organizationName: string };
type Result = { status?: number; body: unknown; headers?: Record<string, string> };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function fail(status: number, error: string, message: string): Result {
  return { status, body: { error, message } };
}

async function context(request: Request): Promise<Context | Result> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return fail(401, "UNAUTHENTICATED", "Authentication is required");
  const response = await fetch(authSessionUrl, { headers: { cookie, accept: "application/json" }, cache: "no-store" });
  if (!response.ok) return fail(401, "UNAUTHENTICATED", "Session is invalid or expired");
  const body = await response.json().catch(() => null) as Record<string, any> | null;
  const userId = body?.user?.id;
  const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") return fail(401, "TENANT_CONTEXT_REQUIRED", "Select an active restaurant organization");
  const rows = await sql<{ role: string; organization_name: string }[]>`
    select m.role, o.name as organization_name
    from mandys.member m
    join mandys.organization o on o.id=m.organization_id
    where m.organization_id=${organizationId} and m.user_id=${userId}
    limit 1
  `;
  const member = rows[0];
  if (!member) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role: member.role, organizationName: member.organization_name };
}

async function exportTenant(ctx: Context): Promise<Result> {
  if (ctx.role !== "owner") return fail(403, "FORBIDDEN", "Only an organization owner can export all tenant data");
  const data = await sql.begin(async tx => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    const organization = (await tx<any[]>`select id,name,slug,logo,created_at,metadata from mandys.organization where id=${ctx.organizationId} limit 1`)[0] ?? null;
    const members = await tx<any[]>`select m.id,m.role,m.created_at,u.id as user_id,u.name,u.email,u.email_verified,u.image from mandys.member m join mandys."user" u on u.id=m.user_id where m.organization_id=${ctx.organizationId} order by m.created_at`;
    const invitations = await tx<any[]>`select id,email,role,status,expires_at,inviter_id,created_at from mandys.invitation where organization_id=${ctx.organizationId} order by created_at`;
    const tenantSettings = await tx<any[]>`select * from mandys.tenant_settings where organization_id=${ctx.organizationId}`;
    const profiles = await tx<any[]>`select * from mandys.restaurant_profiles where organization_id=${ctx.organizationId}`;
    const locations = await tx<any[]>`select * from mandys.locations where organization_id=${ctx.organizationId}`;
    const openingHours = await tx<any[]>`select * from mandys.opening_hours where organization_id=${ctx.organizationId}`;
    const domains = await tx<any[]>`select * from mandys.domains where organization_id=${ctx.organizationId}`;
    const moduleEntitlements = await tx<any[]>`select * from mandys.module_entitlements where organization_id=${ctx.organizationId}`;
    const themeEntitlements = await tx<any[]>`select * from mandys.theme_entitlements where organization_id=${ctx.organizationId}`;
    const themeSettings = await tx<any[]>`select * from mandys.tenant_theme_settings where organization_id=${ctx.organizationId}`;
    const menus = await tx<any[]>`select * from mandys.menus where organization_id=${ctx.organizationId}`;
    const menuTranslations = await tx<any[]>`select * from mandys.menu_translations where organization_id=${ctx.organizationId}`;
    const menuCategories = await tx<any[]>`select * from mandys.menu_categories where organization_id=${ctx.organizationId}`;
    const menuCategoryTranslations = await tx<any[]>`select * from mandys.menu_category_translations where organization_id=${ctx.organizationId}`;
    const menuItems = await tx<any[]>`select * from mandys.menu_items where organization_id=${ctx.organizationId}`;
    const menuItemTranslations = await tx<any[]>`select * from mandys.menu_item_translations where organization_id=${ctx.organizationId}`;
    const allergens = await tx<any[]>`select * from mandys.allergens where organization_id=${ctx.organizationId}`;
    const menuItemAllergens = await tx<any[]>`select * from mandys.menu_item_allergens where organization_id=${ctx.organizationId}`;
    const customers = await tx<any[]>`select * from mandys.customers where organization_id=${ctx.organizationId}`;
    const diningAreas = await tx<any[]>`select * from mandys.dining_areas where organization_id=${ctx.organizationId}`;
    const restaurantTables = await tx<any[]>`select * from mandys.restaurant_tables where organization_id=${ctx.organizationId}`;
    const reservations = await tx<any[]>`select * from mandys.reservations where organization_id=${ctx.organizationId}`;
    const reservationExceptions = await tx<any[]>`select * from mandys.reservation_exceptions where organization_id=${ctx.organizationId}`;
    const reservationWaitlist = await tx<any[]>`select * from mandys.reservation_waitlist where organization_id=${ctx.organizationId}`;
    const eventLeads = await tx<any[]>`select * from mandys.event_leads where organization_id=${ctx.organizationId}`;
    const orders = await tx<any[]>`select * from mandys.orders where organization_id=${ctx.organizationId}`;
    const orderItems = await tx<any[]>`select * from mandys.order_items where organization_id=${ctx.organizationId}`;
    const ingredients = await tx<any[]>`select * from mandys.ingredients where organization_id=${ctx.organizationId}`;
    const suppliers = await tx<any[]>`select * from mandys.suppliers where organization_id=${ctx.organizationId}`;
    const recipes = await tx<any[]>`select * from mandys.recipes where organization_id=${ctx.organizationId}`;
    const recipeIngredients = await tx<any[]>`select * from mandys.recipe_ingredients where organization_id=${ctx.organizationId}`;
    const stockMovements = await tx<any[]>`select * from mandys.stock_movements where organization_id=${ctx.organizationId}`;
    const notifications = await tx<any[]>`select * from mandys.notifications where organization_id=${ctx.organizationId}`;
    const notificationReceipts = await tx<any[]>`select * from mandys.notification_receipts where organization_id=${ctx.organizationId}`;
    const auditLogs = await tx<any[]>`select id,organization_id,actor_user_id,action,entity_type,entity_id,request_id,metadata,created_at from mandys.audit_logs where organization_id=${ctx.organizationId} order by created_at`;
    const subscription = (await tx<any[]>`select id,organization_id,plan_key,status,trial_started_at,trial_ends_at,current_period_started_at,current_period_ends_at,cancel_at_period_end,provider,created_at,updated_at from mandys.tenant_subscriptions where organization_id=${ctx.organizationId} limit 1`)[0] ?? null;
    const subscriptionEvents = await tx<any[]>`select id,organization_id,event_type,provider,metadata,created_at from mandys.subscription_events where organization_id=${ctx.organizationId} order by created_at`;
    return {
      format: "mandys-tenant-export-v1",
      generatedAt: new Date().toISOString(),
      organization,
      team: { members, invitations },
      settings: { tenantSettings, profiles, locations, openingHours, domains, moduleEntitlements, themeEntitlements, themeSettings },
      menu: { menus, translations: menuTranslations, categories: menuCategories, categoryTranslations: menuCategoryTranslations, items: menuItems, itemTranslations: menuItemTranslations, allergens, itemAllergens: menuItemAllergens },
      customers,
      reservations: { reservations, exceptions: reservationExceptions, waitlist: reservationWaitlist, diningAreas, restaurantTables },
      events: eventLeads,
      orders: { orders, items: orderItems },
      stock: { ingredients, suppliers, recipes, recipeIngredients, movements: stockMovements },
      notifications: { notifications, receipts: notificationReceipts },
      auditLogs,
      subscription: { current: subscription, events: subscriptionEvents },
    };
  });
  const safeName = ctx.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "restaurant";
  return { body: data, headers: { "content-disposition": `attachment; filename="mandys-${safeName}-export.json"` } };
}

async function deleteTenant(ctx: Context, request: Request): Promise<Result> {
  if (ctx.role !== "owner") return fail(403, "FORBIDDEN", "Only an organization owner can delete the tenant");
  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== "DELETE") return fail(400, "CONFIRMATION_REQUIRED", "Type DELETE to confirm permanent deletion");

  await sql.begin(async tx => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    await tx`select id from mandys.organization where id=${ctx.organizationId} for update`;
    await tx`delete from mandys.notification_receipts where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.notifications where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.order_items where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.orders where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.stock_movements where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.recipe_ingredients where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.recipes where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.reservation_waitlist where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.reservations where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.reservation_exceptions where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.event_leads where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.menu_item_allergens where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.menu_item_translations where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.menu_items where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.menu_category_translations where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.menu_categories where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.menu_translations where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.menus where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.restaurant_tables where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.dining_areas where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.opening_hours where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.restaurant_profiles where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.ingredients where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.suppliers where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.allergens where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.customers where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.domains where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.locations where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.module_entitlements where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.theme_entitlements where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.tenant_theme_settings where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.tenant_settings where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.subscription_events where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.tenant_subscriptions where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.audit_logs where organization_id=${ctx.organizationId}`;
    await tx`update mandys.session set active_organization_id=null,updated_at=now() where active_organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.invitation where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.member where organization_id=${ctx.organizationId}`;
    await tx`delete from mandys.organization where id=${ctx.organizationId}`;
  });
  return { body: { data: { deleted: true } } };
}

Deno.serve(async request => {
  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-data-protection"))) return json({ ok: true, service: "mandys-data-protection" });
  try {
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);
    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);
    let result: Result;
    if (request.method === "GET" && path === "/v1/export") result = await exportTenant(ctxOrError);
    else if (request.method === "DELETE" && path === "/v1/tenant") result = await deleteTenant(ctxOrError, request);
    else result = fail(404, "NOT_FOUND", "Route not found");
    return json(result.body, result.status ?? 200, result.headers);
  } catch (error) {
    console.error("mandys-data-protection error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Data protection operation could not be completed" }, 500);
  }
});
