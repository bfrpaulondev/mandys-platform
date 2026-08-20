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
  connection: { application_name: "mandys-special-hours-edge", search_path: "mandys,public" },
});

type Context = { userId: string; organizationId: string; role: string };
type Result = { status?: number; body: unknown };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function fail(status: number, error: string, message: string): Result {
  return { status, body: { error, message } };
}

function allowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.protocol !== "https:") return false;
    return url.hostname === "mandys.pt" || url.hostname.endsWith(".mandys.pt") || url.hostname.endsWith(".vercel.app") || url.hostname.endsWith(".netlify.app");
  } catch {
    return false;
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function timeValue(value: unknown): string | null {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

function dateValue(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function optionalLabel(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  return next.length <= 120 ? next || null : undefined;
}

async function context(request: Request): Promise<Context | Result> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return fail(401, "UNAUTHENTICATED", "Authentication is required");
  const response = await fetch(authSessionUrl, {
    method: "GET",
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return fail(401, "UNAUTHENTICATED", "Session is invalid or expired");
  const body = await response.json().catch(() => null) as any;
  const userId = body?.user?.id;
  const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") {
    return fail(401, "TENANT_CONTEXT_REQUIRED", "Select an active restaurant organization");
  }
  const members = await sql<{ role: string }[]>`
    select role from mandys.member
    where organization_id = ${organizationId} and user_id = ${userId}
    limit 1
  `;
  const role = members[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}

function canConfigure(ctx: Context): boolean {
  return ctx.role === "owner" || ctx.role === "manager";
}

async function audit(tx: any, ctx: Context, action: string, entityId: string | null, metadata: Record<string, unknown>) {
  await tx`
    insert into mandys.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (${ctx.organizationId}, ${ctx.userId}, ${action}, 'special_opening_hours', ${entityId}, ${tx.json(metadata)})
  `;
}

async function activeLocation(tx: any, organizationId: string) {
  const rows = await tx<any[]>`
    select id, name from mandys.locations
    where organization_id = ${organizationId} and is_active = true
    order by created_at asc
    limit 1
  `;
  return rows[0] ?? null;
}

function serialize(row: any) {
  return {
    id: row.id,
    serviceDate: String(row.service_date),
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    isClosed: row.is_closed,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listSpecialHours(ctx: Context): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure special hours");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const location = await activeLocation(tx, ctx.organizationId);
    if (!location) return fail(409, "RESTAURANT_NOT_CONFIGURED", "Configure the restaurant before special hours");
    const rows = await tx<any[]>`
      select id, service_date, opens_at, closes_at, is_closed, label, created_at, updated_at
      from mandys.special_opening_hours
      where organization_id = ${ctx.organizationId} and location_id = ${location.id}::uuid
      order by service_date asc
      limit 500
    `;
    return { body: { data: { location, specialHours: rows.map(serialize) } } };
  });
}

async function upsertSpecialHours(ctx: Context, body: any): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure special hours");
  const serviceDate = dateValue(body?.serviceDate);
  const isClosed = body?.isClosed;
  const label = optionalLabel(body?.label);
  if (!serviceDate || typeof isClosed !== "boolean" || label === undefined) {
    return fail(400, "INVALID_REQUEST", "Special-hours data is invalid");
  }
  const opensAt = isClosed ? null : timeValue(body?.opensAt);
  const closesAt = isClosed ? null : timeValue(body?.closesAt);
  if (!isClosed && (!opensAt || !closesAt || opensAt === closesAt)) {
    return fail(400, "INVALID_REQUEST", "Open special dates require valid opening and closing times");
  }

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const location = await activeLocation(tx, ctx.organizationId);
    if (!location) return fail(409, "RESTAURANT_NOT_CONFIGURED", "Configure the restaurant before special hours");
    const rows = await tx<any[]>`
      insert into mandys.special_opening_hours (
        organization_id, location_id, service_date, opens_at, closes_at, is_closed, label
      ) values (
        ${ctx.organizationId}, ${location.id}::uuid, ${serviceDate}::date, ${opensAt}, ${closesAt}, ${isClosed}, ${label}
      )
      on conflict (location_id, service_date)
      do update set
        opens_at = excluded.opens_at,
        closes_at = excluded.closes_at,
        is_closed = excluded.is_closed,
        label = excluded.label,
        updated_at = now()
      returning id, service_date, opens_at, closes_at, is_closed, label, created_at, updated_at
    `;
    const row = rows[0];
    await audit(tx, ctx, "special_opening_hours.upserted", row.id, {
      locationId: location.id,
      serviceDate,
      isClosed,
      opensAt,
      closesAt,
      label,
    });
    return { body: { data: serialize(row) } };
  });
}

async function deleteSpecialHours(ctx: Context, id: string): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure special hours");
  if (!isUuid(id)) return fail(400, "INVALID_REQUEST", "Special-hours id is invalid");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const location = await activeLocation(tx, ctx.organizationId);
    if (!location) return fail(409, "RESTAURANT_NOT_CONFIGURED", "Configure the restaurant before special hours");
    const rows = await tx<any[]>`
      delete from mandys.special_opening_hours
      where organization_id = ${ctx.organizationId}
        and location_id = ${location.id}::uuid
        and id = ${id}::uuid
      returning id, service_date, is_closed, label
    `;
    const row = rows[0];
    if (!row) return fail(404, "NOT_FOUND", "Special-hours override not found");
    await audit(tx, ctx, "special_opening_hours.deleted", row.id, {
      locationId: location.id,
      serviceDate: String(row.service_date),
      isClosed: row.is_closed,
      label: row.label,
    });
    return { body: { data: { deleted: true, id: row.id } } };
  });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { allow: "GET,PUT,DELETE,OPTIONS" } });
  }
  if (request.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-special-hours"))) {
    return json({ ok: true, service: "mandys-special-hours" });
  }
  if (!allowedOrigin(request.headers.get("origin"))) {
    return json({ error: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed" }, 403);
  }

  try {
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);
    const ctx = ctxOrError;
    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);
    let result: Result;
    if (request.method === "GET" && path === "/v1/settings") result = await listSpecialHours(ctx);
    else if (request.method === "PUT" && path === "/v1/settings") result = await upsertSpecialHours(ctx, await request.json().catch(() => null));
    else if (request.method === "DELETE" && /^\/v1\/settings\/[0-9a-f-]+$/i.test(path)) result = await deleteSpecialHours(ctx, path.split("/")[3] ?? "");
    else result = fail(404, "NOT_FOUND", "Route not found");
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-special-hours error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Special hours could not be completed" }, 500);
  }
});
