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
  connection: { application_name: "mandys-orders-edge", search_path: "mandys,public" },
});

type Context = { userId: string; organizationId: string; role: string };
type Result = { status?: number; body: unknown };
type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
function fail(status: number, error: string, message: string): Result { return { status, body: { error, message } }; }
function isUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function text(value: unknown, min: number, max: number): string | null { if (typeof value !== "string") return null; const next = value.trim(); return next.length >= min && next.length <= max ? next : null; }
function email(value: unknown): string | null { if (value === undefined || value === null || value === "") return null; if (typeof value !== "string") return null; const next = value.trim().toLowerCase(); return next.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) ? next : null; }
function normalizeHostname(value: unknown): string | null { if (typeof value !== "string") return null; const normalized = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0]; return normalized && normalized.length <= 253 ? normalized : null; }
function normalizeLocale(value: unknown): string { return typeof value === "string" && ["pt-PT", "pt-BR", "en", "es"].includes(value) ? value : "pt-PT"; }
async function clientHash(req: Request): Promise<string> { const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown"; const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)); return Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function rateLimit(tx: any, key: string, max: number): Promise<boolean> { const rows = await tx<any[]>`insert into mandys.public_request_limits (key,window_started_at,request_count,updated_at) values (${key},now(),1,now()) on conflict (key) do update set request_count=case when mandys.public_request_limits.window_started_at<now()-interval '1 minute' then 1 else mandys.public_request_limits.request_count+1 end,window_started_at=case when mandys.public_request_limits.window_started_at<now()-interval '1 minute' then now() else mandys.public_request_limits.window_started_at end,updated_at=now() returning request_count`; return Number(rows[0]?.request_count ?? 1) <= max; }

async function context(request: Request): Promise<Context | Result> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return fail(401, "UNAUTHENTICATED", "Authentication is required");
  const response = await fetch(authSessionUrl, { headers: { cookie, accept: "application/json" }, cache: "no-store" });
  if (!response.ok) return fail(401, "UNAUTHENTICATED", "Session is invalid or expired");
  const body = await response.json().catch(() => null) as any;
  const userId = body?.user?.id;
  const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") return fail(401, "TENANT_CONTEXT_REQUIRED", "Select an active restaurant organization");
  const members = await sql<{ role: string }[]>`select role from mandys.member where organization_id=${organizationId} and user_id=${userId} limit 1`;
  const role = members[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}
function canRead(ctx: Context) { return ["owner", "manager", "reception", "kitchen", "staff"].includes(ctx.role); }
function canUpdate(ctx: Context) { return ["owner", "manager", "reception", "kitchen", "staff"].includes(ctx.role); }
async function assertEnabled(tx: any, organizationId: string) { const rows = await tx<any[]>`select status from mandys.module_entitlements where organization_id=${organizationId} and module_key='orders' limit 1`; if (!rows[0] || rows[0].status === "disabled") throw new Error("ORDERS_DISABLED"); }
async function audit(tx: any, organizationId: string, userId: string | null, action: string, entityId: string, metadata: Record<string, unknown>, ipHash?: string | null) { await tx`insert into mandys.audit_logs (organization_id,actor_user_id,action,entity_type,entity_id,ip_hash,metadata) values (${organizationId},${userId},${action},'order',${entityId},${ipHash ?? null},${tx.json(metadata)})`; }

async function resolvePublic(hostname: string) {
  const rows = await sql<any[]>`select organization_id from mandys.domains where hostname=${hostname} and verified_at is not null limit 1`;
  const organizationId = rows[0]?.organization_id;
  if (!organizationId) return null;
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${organizationId},true)`;
    await assertEnabled(tx, organizationId);
    const [locationRows, settingsRows] = await Promise.all([
      tx<any[]>`select id,name from mandys.locations where organization_id=${organizationId} and is_active=true order by created_at asc limit 1`,
      tx<any[]>`select currency from mandys.tenant_settings where organization_id=${organizationId} limit 1`,
    ]);
    if (!locationRows[0]) return null;
    return { organizationId: organizationId as string, locationId: locationRows[0].id as string, locationName: locationRows[0].name as string, currency: settingsRows[0]?.currency ?? "EUR" };
  }).catch((error) => String(error).includes("ORDERS_DISABLED") ? null : Promise.reject(error));
}

async function listOrders(ctx: Context, url: URL): Promise<Result> {
  if (!canRead(ctx)) return fail(403, "FORBIDDEN", "Your role cannot access orders");
  const status = url.searchParams.get("status");
  const limitRaw = Number(url.searchParams.get("limit") ?? 25);
  const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 100 || !Number.isInteger(offsetRaw) || offsetRaw < 0 || offsetRaw > 10000 || (status && !Object.hasOwn(transitions, status))) {
    return fail(400, "INVALID_QUERY", "Order filters or pagination are invalid");
  }
  const limit = limitRaw;
  const offset = offsetRaw;
  const rowLimit = limit + 1;

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    await assertEnabled(tx, ctx.organizationId);
    const [orderRows, summaryRows] = await Promise.all([
      tx<any[]>`
        select id,order_number,status,fulfillment_type,payment_method,currency,subtotal_cents,total_cents,scheduled_for,guest_name,guest_email,guest_phone,notes,source,created_at,updated_at
        from mandys.orders
        where organization_id=${ctx.organizationId} and (${status}::text is null or status=${status})
        order by case when status='pending' then 0 when status='accepted' then 1 when status='preparing' then 2 when status='ready' then 3 else 4 end,created_at asc
        limit ${rowLimit} offset ${offset}
      `,
      tx<any[]>`
        select
          count(*) filter (where created_at >= date_trunc('day', now()))::int as today_count,
          count(*) filter (where status not in ('completed','cancelled'))::int as open_count,
          count(*) filter (where status='ready')::int as ready_count,
          coalesce(sum(total_cents) filter (where status='completed'),0)::bigint as completed_value_cents,
          coalesce(max(currency),'EUR') as currency
        from mandys.orders
        where organization_id=${ctx.organizationId}
      `,
    ]);
    const hasMore = orderRows.length > limit;
    const orders = orderRows.slice(0, limit);
    const ids = orders.map((row: any) => row.id);
    const items = ids.length > 0 ? await tx<any[]>`select id,order_id,menu_item_id,item_name,unit_price_cents,quantity,line_total_cents,notes from mandys.order_items where organization_id=${ctx.organizationId} and order_id in ${tx(ids)} order by created_at asc` : [];
    const summary = summaryRows[0] ?? {};
    return { body: {
      data: orders.map((row: any) => ({
        id: row.id, orderNumber: row.order_number, status: row.status, fulfillmentType: row.fulfillment_type, paymentMethod: row.payment_method,
        currency: row.currency, subtotalCents: row.subtotal_cents, totalCents: row.total_cents, scheduledFor: row.scheduled_for ? new Date(row.scheduled_for).toISOString() : null,
        guestName: row.guest_name, guestEmail: row.guest_email, guestPhone: row.guest_phone, notes: row.notes, source: row.source,
        createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
        items: items.filter((item: any) => item.order_id === row.id).map((item: any) => ({ id: item.id, menuItemId: item.menu_item_id, itemName: item.item_name, unitPriceCents: item.unit_price_cents, quantity: item.quantity, lineTotalCents: item.line_total_cents, notes: item.notes })),
      })),
      pagination: { limit, offset, hasMore },
      summary: {
        today: Number(summary.today_count ?? 0),
        open: Number(summary.open_count ?? 0),
        ready: Number(summary.ready_count ?? 0),
        completedValueCents: Number(summary.completed_value_cents ?? 0),
        currency: summary.currency ?? "EUR",
      },
    } };
  }).catch((error) => String(error).includes("ORDERS_DISABLED") ? fail(403, "ORDERS_DISABLED", "The orders module is not enabled") : Promise.reject(error));
}

async function changeStatus(ctx: Context, orderId: string, body: any): Promise<Result> {
  if (!canUpdate(ctx)) return fail(403, "FORBIDDEN", "Your role cannot update orders");
  const status = typeof body?.status === "string" && Object.hasOwn(transitions, body.status) ? body.status as OrderStatus : null;
  if (!isUuid(orderId) || !status) return fail(400, "INVALID_REQUEST", "Order status update is invalid");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;
    await assertEnabled(tx, ctx.organizationId);
    const currentRows = await tx<any[]>`select id,status from mandys.orders where organization_id=${ctx.organizationId} and id=${orderId}::uuid limit 1`;
    const current = currentRows[0];
    if (!current) return fail(404, "NOT_FOUND", "Order not found");
    if (current.status === status) return { body: { data: { id: orderId, status } } };
    if (!(transitions[current.status as OrderStatus] ?? []).includes(status)) return fail(422, "INVALID_TRANSITION", `Order status cannot transition from ${current.status} to ${status}`);
    const updated = await tx<any[]>`
      update mandys.orders set status=${status},updated_at=now(),
        accepted_at=case when ${status}='accepted' then coalesce(accepted_at,now()) else accepted_at end,
        ready_at=case when ${status}='ready' then coalesce(ready_at,now()) else ready_at end,
        completed_at=case when ${status}='completed' then coalesce(completed_at,now()) else completed_at end,
        cancelled_at=case when ${status}='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end
      where organization_id=${ctx.organizationId} and id=${orderId}::uuid and status=${current.status}
      returning id,status
    `;
    if (!updated[0]) return fail(409, "CONCURRENT_UPDATE", "Order was updated by another request");
    await audit(tx, ctx.organizationId, ctx.userId, "order.status_changed", orderId, { from: current.status, to: status });
    return { body: { data: { id: orderId, status } } };
  }).catch((error) => String(error).includes("ORDERS_DISABLED") ? fail(403, "ORDERS_DISABLED", "The orders module is not enabled") : Promise.reject(error));
}

function parseItems(value: unknown): Array<{ menuItemId: string; quantity: number; notes: string | null }> | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;
  const parsed = value.map((entry: any) => ({ menuItemId: entry?.menuItemId, quantity: Number(entry?.quantity), notes: entry?.notes ? text(entry.notes, 1, 500) : null }));
  if (parsed.some((item) => !isUuid(item.menuItemId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 || (value.find((entry: any) => entry?.menuItemId === item.menuItemId)?.notes && !item.notes))) return null;
  if (new Set(parsed.map((item) => item.menuItemId)).size !== parsed.length) return null;
  return parsed;
}

async function createPublicOrder(req: Request, body: any): Promise<Result> {
  const hostname = normalizeHostname(body?.hostname);
  const guestName = text(body?.guestName, 2, 160);
  const guestEmail = email(body?.guestEmail);
  const guestPhone = body?.guestPhone ? text(body.guestPhone, 1, 40) : null;
  const notes = body?.notes ? text(body.notes, 1, 2000) : null;
  const requestedItems = parseItems(body?.items);
  if (!hostname || !guestName || !requestedItems || (body?.guestEmail && !guestEmail) || (body?.guestPhone && !guestPhone) || (body?.notes && !notes)) return fail(400, "INVALID_REQUEST", "Order data is invalid");
  if (!guestEmail && !guestPhone) return fail(400, "CONTACT_REQUIRED", "Email or phone is required for takeaway orders");
  const target = await resolvePublic(hostname);
  if (!target) return fail(404, "ORDERS_UNAVAILABLE", "Online ordering is not available for this restaurant");
  const hash = await clientHash(req);

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id',${target.organizationId},true)`;
    if (!(await rateLimit(tx, `public-order:${target.organizationId}:${hash}`, 12))) return fail(429, "RATE_LIMITED", "Too many order attempts. Please try again shortly.");
    const ids = requestedItems.map((item) => item.menuItemId);
    const locale = normalizeLocale(body?.locale);
    const catalog = await tx<any[]>`
      select mi.id,mi.price_cents,
        coalesce(mt.name,pt.name,anyt.name) as item_name
      from mandys.menu_items mi
      join mandys.menu_categories mc on mc.organization_id=mi.organization_id and mc.id=mi.category_id and mc.is_visible=true
      join mandys.menus m on m.organization_id=mi.organization_id and m.id=mc.menu_id and m.is_published=true
      left join mandys.menu_item_translations mt on mt.organization_id=mi.organization_id and mt.menu_item_id=mi.id and mt.locale=${locale}::mandys.locale_code
      left join mandys.menu_item_translations pt on pt.organization_id=mi.organization_id and pt.menu_item_id=mi.id and pt.locale='pt-PT'::mandys.locale_code
      left join lateral (select name from mandys.menu_item_translations x where x.organization_id=mi.organization_id and x.menu_item_id=mi.id order by x.locale limit 1) anyt on true
      where mi.organization_id=${target.organizationId} and mi.id in ${tx(ids)} and mi.is_available=true
        and (m.location_id is null or m.location_id=${target.locationId}::uuid)
    `;
    if (catalog.length !== ids.length) return fail(409, "CATALOG_CHANGED", "One or more items are no longer available");

    const lines = requestedItems.map((requested) => {
      const item = catalog.find((row: any) => row.id === requested.menuItemId);
      const unitPriceCents = Number(item.price_cents);
      return { ...requested, itemName: item.item_name as string, unitPriceCents, lineTotalCents: unitPriceCents * requested.quantity };
    });
    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    if (subtotalCents <= 0) return fail(409, "INVALID_TOTAL", "Order total is invalid");

    let customerId: string | null = null;
    const existing = guestEmail
      ? await tx<any[]>`select id from mandys.customers where organization_id=${target.organizationId} and lower(email)=${guestEmail} limit 1`
      : await tx<any[]>`select id from mandys.customers where organization_id=${target.organizationId} and phone=${guestPhone} limit 1`;
    customerId = existing[0]?.id ?? null;
    if (!customerId) {
      const parts = guestName.split(/\s+/); const firstName = parts.shift() ?? guestName; const lastName = parts.join(" ") || null;
      const customer = await tx<any[]>`insert into mandys.customers (organization_id,first_name,last_name,email,phone,preferred_locale) values (${target.organizationId},${firstName},${lastName},${guestEmail},${guestPhone},${locale}::mandys.locale_code) returning id`;
      customerId = customer[0]?.id ?? null;
    }

    const orders = await tx<any[]>`
      insert into mandys.orders (organization_id,location_id,customer_id,status,fulfillment_type,payment_method,currency,subtotal_cents,total_cents,guest_name,guest_email,guest_phone,notes,source)
      values (${target.organizationId},${target.locationId}::uuid,${customerId}::uuid,'pending','pickup','pay_at_pickup',${target.currency},${subtotalCents},${subtotalCents},${guestName},${guestEmail},${guestPhone},${notes},'storefront')
      returning id,order_number,status,currency,total_cents,created_at
    `;
    const order = orders[0];
    await tx`insert into mandys.order_items ${tx(lines.map((line) => ({ organization_id: target.organizationId, order_id: order.id, menu_item_id: line.menuItemId, item_name: line.itemName, unit_price_cents: line.unitPriceCents, quantity: line.quantity, line_total_cents: line.lineTotalCents, notes: line.notes })))} `;
    await audit(tx, target.organizationId, null, "order.public_created", order.id, { orderNumber: order.order_number, totalCents: order.total_cents, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0), source: "storefront" }, hash);
    return { status: 201, body: { data: { id: order.id, orderNumber: order.order_number, status: order.status, currency: order.currency, totalCents: order.total_cents, createdAt: new Date(order.created_at).toISOString(), paymentMethod: "pay_at_pickup", fulfillmentType: "pickup" } } };
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-orders"))) return json({ ok: true, service: "mandys-orders" });
  try {
    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);
    if (request.method === "POST" && path === "/v1/public/orders") {
      const result = await createPublicOrder(request, await request.json().catch(() => null));
      return json(result.body, result.status ?? 200);
    }
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);
    let result: Result;
    if (request.method === "GET" && path === "/v1/orders") result = await listOrders(ctxOrError, url);
    else if (request.method === "PATCH" && /^\/v1\/orders\/[0-9a-f-]+\/status$/i.test(path)) result = await changeStatus(ctxOrError, path.split("/")[3] ?? "", await request.json().catch(() => null));
    else result = fail(404, "NOT_FOUND", "Route not found");
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-orders error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Order operation could not be completed" }, 500);
  }
});