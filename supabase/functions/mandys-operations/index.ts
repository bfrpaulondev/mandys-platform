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
  connection: { application_name: "mandys-operations-edge", search_path: "mandys,public" },
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

function boundedText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next.length >= min && next.length <= max ? next : null;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  return next.length <= max ? next : undefined;
}

function optionalEmail(value: unknown): string | null | undefined {
  const next = optionalText(value, 254);
  if (next === null || next === undefined) return next;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) ? next.toLowerCase() : undefined;
}

function optionalHttpsUrl(value: unknown): string | null | undefined {
  const next = optionalText(value, 2048);
  if (next === null || next === undefined) return next;
  try {
    const url = new URL(next);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function timeValue(value: unknown): string | null {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

async function context(request: Request): Promise<Context | Result> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return fail(401, "UNAUTHENTICATED", "Authentication is required");
  const response = await fetch(authSessionUrl, { method: "GET", headers: { cookie, accept: "application/json" }, cache: "no-store" });
  if (!response.ok) return fail(401, "UNAUTHENTICATED", "Session is invalid or expired");
  const body = await response.json().catch(() => null) as any;
  const userId = body?.user?.id;
  const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") return fail(401, "TENANT_CONTEXT_REQUIRED", "Select an active restaurant organization");
  const members = await sql<{ role: string }[]>`select role from mandys.member where organization_id = ${organizationId} and user_id = ${userId} limit 1`;
  const role = members[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}

function canConfigure(ctx: Context): boolean {
  return ctx.role === "owner" || ctx.role === "manager";
}

async function audit(tx: any, ctx: Context, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
  await tx`insert into mandys.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata) values (${ctx.organizationId}, ${ctx.userId}, ${action}, ${entityType}, ${entityId}, ${tx.json(metadata)})`;
}

async function activeLocation(tx: any, organizationId: string) {
  const rows = await tx<any[]>`select * from mandys.locations where organization_id = ${organizationId} order by is_active desc, created_at asc limit 1`;
  return rows[0] ?? null;
}

async function profileSnapshot(tx: any, organizationId: string) {
  const location = await activeLocation(tx, organizationId);
  if (!location) return null;
  const profiles = await tx<any[]>`select * from mandys.restaurant_profiles where organization_id = ${organizationId} and (location_id = ${location.id}::uuid or location_id is null) order by location_id nulls last, created_at asc limit 1`;
  const profile = profiles[0];
  if (!profile) return null;
  return {
    profile: {
      id: profile.id,
      publicName: profile.public_name,
      legalName: profile.legal_name,
      description: profile.description,
      logoUrl: profile.logo_url,
      coverUrl: profile.cover_url,
      contactEmail: profile.contact_email,
      contactPhone: profile.contact_phone,
      reservationDurationMinutes: profile.reservation_duration_minutes,
    },
    location: {
      id: location.id,
      name: location.name,
      email: location.email,
      phone: location.phone,
      addressLine1: location.address_line_1,
      addressLine2: location.address_line_2,
      postalCode: location.postal_code,
      city: location.city,
      countryCode: location.country_code,
    },
  };
}

async function readProfile(ctx: Context): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure the restaurant profile");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const snapshot = await profileSnapshot(tx, ctx.organizationId);
    if (!snapshot) return fail(409, "RESTAURANT_NOT_CONFIGURED", "Configure the restaurant before editing its profile");
    return { body: { data: snapshot } };
  });
}

async function saveProfile(ctx: Context, body: any): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure the restaurant profile");
  const publicName = boundedText(body?.publicName, 2, 120);
  const legalName = optionalText(body?.legalName, 180);
  const description = optionalText(body?.description, 2000);
  const logoUrl = optionalHttpsUrl(body?.logoUrl);
  const coverUrl = optionalHttpsUrl(body?.coverUrl);
  const contactEmail = optionalEmail(body?.contactEmail);
  const contactPhone = optionalText(body?.contactPhone, 50);
  const duration = Number(body?.reservationDurationMinutes);
  const locationName = boundedText(body?.locationName, 1, 120);
  const locationEmail = optionalEmail(body?.locationEmail);
  const locationPhone = optionalText(body?.locationPhone, 50);
  const addressLine1 = optionalText(body?.addressLine1, 180);
  const addressLine2 = optionalText(body?.addressLine2, 180);
  const postalCode = optionalText(body?.postalCode, 30);
  const city = optionalText(body?.city, 100);
  const countryCode = typeof body?.countryCode === "string" && /^[A-Za-z]{2}$/.test(body.countryCode.trim()) ? body.countryCode.trim().toUpperCase() : null;

  if (!publicName || !locationName || !countryCode || !Number.isInteger(duration) || duration < 30 || duration > 480 || [legalName, description, logoUrl, coverUrl, contactEmail, contactPhone, locationEmail, locationPhone, addressLine1, addressLine2, postalCode, city].some((value) => value === undefined)) {
    return fail(400, "INVALID_REQUEST", "Restaurant profile data is invalid");
  }

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const location = await activeLocation(tx, ctx.organizationId);
    if (!location) return fail(409, "RESTAURANT_NOT_CONFIGURED", "Configure the restaurant before editing its profile");
    const profiles = await tx<any[]>`select id from mandys.restaurant_profiles where organization_id = ${ctx.organizationId} and (location_id = ${location.id}::uuid or location_id is null) order by location_id nulls last, created_at asc limit 1`;
    const profile = profiles[0];
    if (!profile) return fail(409, "RESTAURANT_NOT_CONFIGURED", "Restaurant profile is missing");

    await tx`update mandys.restaurant_profiles set public_name = ${publicName}, legal_name = ${legalName}, description = ${description}, logo_url = ${logoUrl}, cover_url = ${coverUrl}, contact_email = ${contactEmail}, contact_phone = ${contactPhone}, reservation_duration_minutes = ${duration}, location_id = ${location.id}::uuid, updated_at = now() where organization_id = ${ctx.organizationId} and id = ${profile.id}::uuid`;
    await tx`update mandys.locations set name = ${locationName}, email = ${locationEmail}, phone = ${locationPhone}, address_line_1 = ${addressLine1}, address_line_2 = ${addressLine2}, postal_code = ${postalCode}, city = ${city}, country_code = ${countryCode}, updated_at = now() where organization_id = ${ctx.organizationId} and id = ${location.id}::uuid`;
    await audit(tx, ctx, "restaurant_profile.updated", "restaurant_profile", profile.id, { locationId: location.id, publicName, countryCode });

    const snapshot = await profileSnapshot(tx, ctx.organizationId);
    return { body: { data: snapshot } };
  });
}

async function readOperations(ctx: Context): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure operations");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const locations = await tx<any[]>`select id, name, slug, is_active from mandys.locations where organization_id = ${ctx.organizationId} order by is_active desc, created_at asc`;
    const locationId = locations.find((row: any) => row.is_active)?.id ?? locations[0]?.id ?? null;
    if (!locationId) return fail(409, "RESTAURANT_NOT_CONFIGURED", "Configure the restaurant before operational settings");
    const [hours, areas, tables] = await Promise.all([
      tx<any[]>`select id, weekday, opens_at, closes_at, is_closed from mandys.opening_hours where organization_id = ${ctx.organizationId} and location_id = ${locationId}::uuid order by weekday asc`,
      tx<any[]>`select id, name, sort_order, is_active from mandys.dining_areas where organization_id = ${ctx.organizationId} and location_id = ${locationId}::uuid order by sort_order asc, created_at asc`,
      tx<any[]>`select id, dining_area_id, name, min_seats, max_seats, is_active from mandys.restaurant_tables where organization_id = ${ctx.organizationId} and location_id = ${locationId}::uuid order by created_at asc`,
    ]);
    return { body: { data: { location: { id: locationId, name: locations.find((row: any) => row.id === locationId)?.name ?? "Principal" }, openingHours: hours.map((row: any) => ({ id: row.id, weekday: row.weekday, opensAt: row.opens_at, closesAt: row.closes_at, isClosed: row.is_closed })), diningAreas: areas.map((row: any) => ({ id: row.id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active })), tables: tables.map((row: any) => ({ id: row.id, diningAreaId: row.dining_area_id, name: row.name, minSeats: row.min_seats, maxSeats: row.max_seats, isActive: row.is_active })) } } };
  });
}

async function saveHours(ctx: Context, body: any): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure operations");
  if (!isUuid(body?.locationId) || !Array.isArray(body?.hours) || body.hours.length !== 7) return fail(400, "INVALID_REQUEST", "Seven opening-hour rows are required");
  const seen = new Set<number>();
  const rows: Array<{ weekday: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }> = [];
  for (const item of body.hours) {
    const weekday = Number(item?.weekday);
    const isClosed = item?.isClosed === true;
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || seen.has(weekday)) return fail(400, "INVALID_REQUEST", "Weekdays must be unique values from 0 to 6");
    seen.add(weekday);
    const opensAt = isClosed ? null : timeValue(item?.opensAt);
    const closesAt = isClosed ? null : timeValue(item?.closesAt);
    if (!isClosed && (!opensAt || !closesAt || opensAt === closesAt)) return fail(400, "INVALID_REQUEST", "Open days require valid opening and closing times");
    rows.push({ weekday, opensAt, closesAt, isClosed });
  }
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const location = await tx<any[]>`select id from mandys.locations where organization_id = ${ctx.organizationId} and id = ${body.locationId}::uuid limit 1`;
    if (!location[0]) return fail(422, "INVALID_LOCATION", "Location does not belong to the active restaurant");
    for (const item of rows) await tx`insert into mandys.opening_hours (organization_id, location_id, weekday, opens_at, closes_at, is_closed) values (${ctx.organizationId}, ${body.locationId}::uuid, ${item.weekday}, ${item.opensAt}, ${item.closesAt}, ${item.isClosed}) on conflict (location_id, weekday) do update set opens_at = excluded.opens_at, closes_at = excluded.closes_at, is_closed = excluded.is_closed, updated_at = now()`;
    await audit(tx, ctx, "opening_hours.updated", "location", body.locationId, { weekdays: rows.map((row) => row.weekday) });
    return { body: { data: { saved: true } } };
  });
}

async function createArea(ctx: Context, body: any): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure operations");
  const name = boundedText(body?.name, 1, 100);
  const sortOrder = Number(body?.sortOrder ?? 0);
  if (!isUuid(body?.locationId) || !name || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) return fail(400, "INVALID_REQUEST", "Dining area data is invalid");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const location = await tx<any[]>`select id from mandys.locations where organization_id = ${ctx.organizationId} and id = ${body.locationId}::uuid limit 1`;
    if (!location[0]) return fail(422, "INVALID_LOCATION", "Location does not belong to the active restaurant");
    const created = await tx<any[]>`insert into mandys.dining_areas (organization_id, location_id, name, sort_order, is_active) values (${ctx.organizationId}, ${body.locationId}::uuid, ${name}, ${sortOrder}, true) returning id, name, sort_order, is_active`;
    const row = created[0];
    await audit(tx, ctx, "dining_area.created", "dining_area", row.id, { locationId: body.locationId, name });
    return { status: 201, body: { data: { id: row.id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active } } };
  });
}

async function updateArea(ctx: Context, areaId: string, body: any): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure operations");
  const name = boundedText(body?.name, 1, 100);
  const sortOrder = Number(body?.sortOrder ?? 0);
  const isActive = body?.isActive;
  if (!isUuid(areaId) || !isUuid(body?.locationId) || !name || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000 || typeof isActive !== "boolean") return fail(400, "INVALID_REQUEST", "Dining area data is invalid");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const current = await tx<any[]>`select id from mandys.dining_areas where organization_id=${ctx.organizationId} and location_id=${body.locationId}::uuid and id=${areaId}::uuid limit 1`;
    if (!current[0]) return fail(404, "NOT_FOUND", "Dining area not found");
    const updated = await tx<any[]>`update mandys.dining_areas set name=${name}, sort_order=${sortOrder}, is_active=${isActive}, updated_at=now() where organization_id=${ctx.organizationId} and location_id=${body.locationId}::uuid and id=${areaId}::uuid returning id,name,sort_order,is_active`;
    if (!isActive) await tx`update mandys.restaurant_tables set is_active=false, updated_at=now() where organization_id=${ctx.organizationId} and dining_area_id=${areaId}::uuid and is_active=true`;
    await audit(tx, ctx, "dining_area.updated", "dining_area", areaId, { locationId: body.locationId, name, sortOrder, isActive });
    const row = updated[0];
    return { body: { data: { id: row.id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active } } };
  });
}

async function createTable(ctx: Context, body: any): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure operations");
  const name = boundedText(body?.name, 1, 80);
  const minSeats = Number(body?.minSeats ?? 1);
  const maxSeats = Number(body?.maxSeats);
  if (!isUuid(body?.locationId) || !isUuid(body?.diningAreaId) || !name || !Number.isInteger(minSeats) || !Number.isInteger(maxSeats) || minSeats < 1 || maxSeats < minSeats || maxSeats > 100) return fail(400, "INVALID_REQUEST", "Table data is invalid");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const area = await tx<any[]>`select id from mandys.dining_areas where organization_id = ${ctx.organizationId} and location_id = ${body.locationId}::uuid and id = ${body.diningAreaId}::uuid and is_active = true limit 1`;
    if (!area[0]) return fail(422, "INVALID_DINING_AREA", "Dining area does not belong to the active restaurant");
    try {
      const created = await tx<any[]>`insert into mandys.restaurant_tables (organization_id, location_id, dining_area_id, name, min_seats, max_seats, is_active) values (${ctx.organizationId}, ${body.locationId}::uuid, ${body.diningAreaId}::uuid, ${name}, ${minSeats}, ${maxSeats}, true) returning id, dining_area_id, name, min_seats, max_seats, is_active`;
      const row = created[0];
      await audit(tx, ctx, "restaurant_table.created", "restaurant_table", row.id, { locationId: body.locationId, diningAreaId: body.diningAreaId, maxSeats });
      return { status: 201, body: { data: { id: row.id, diningAreaId: row.dining_area_id, name: row.name, minSeats: row.min_seats, maxSeats: row.max_seats, isActive: row.is_active } } };
    } catch (error) {
      if (String(error).includes("restaurant_tables_area_name_uidx")) return fail(409, "TABLE_NAME_EXISTS", "A table with this name already exists in the area");
      throw error;
    }
  });
}

async function updateTable(ctx: Context, tableId: string, body: any): Promise<Result> {
  if (!canConfigure(ctx)) return fail(403, "FORBIDDEN", "Only owners and managers can configure operations");
  const name = boundedText(body?.name, 1, 80);
  const minSeats = Number(body?.minSeats ?? 1);
  const maxSeats = Number(body?.maxSeats);
  const isActive = body?.isActive;
  if (!isUuid(tableId) || !isUuid(body?.locationId) || !isUuid(body?.diningAreaId) || !name || !Number.isInteger(minSeats) || !Number.isInteger(maxSeats) || minSeats < 1 || maxSeats < minSeats || maxSeats > 100 || typeof isActive !== "boolean") return fail(400, "INVALID_REQUEST", "Table data is invalid");
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const current = await tx<any[]>`select id from mandys.restaurant_tables where organization_id=${ctx.organizationId} and location_id=${body.locationId}::uuid and id=${tableId}::uuid limit 1`;
    if (!current[0]) return fail(404, "NOT_FOUND", "Table not found");
    const area = await tx<any[]>`select id,is_active from mandys.dining_areas where organization_id=${ctx.organizationId} and location_id=${body.locationId}::uuid and id=${body.diningAreaId}::uuid limit 1`;
    if (!area[0] || (isActive && !area[0].is_active)) return fail(422, "INVALID_DINING_AREA", "Active tables require an active dining area in this restaurant");
    try {
      const updated = await tx<any[]>`update mandys.restaurant_tables set dining_area_id=${body.diningAreaId}::uuid, name=${name}, min_seats=${minSeats}, max_seats=${maxSeats}, is_active=${isActive}, updated_at=now() where organization_id=${ctx.organizationId} and location_id=${body.locationId}::uuid and id=${tableId}::uuid returning id,dining_area_id,name,min_seats,max_seats,is_active`;
      await audit(tx, ctx, "restaurant_table.updated", "restaurant_table", tableId, { locationId: body.locationId, diningAreaId: body.diningAreaId, minSeats, maxSeats, isActive });
      const row = updated[0];
      return { body: { data: { id: row.id, diningAreaId: row.dining_area_id, name: row.name, minSeats: row.min_seats, maxSeats: row.max_seats, isActive: row.is_active } } };
    } catch (error) {
      if (String(error).includes("restaurant_tables_area_name_uidx")) return fail(409, "TABLE_NAME_EXISTS", "A table with this name already exists in the area");
      throw error;
    }
  });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { allow: "GET,POST,PUT,PATCH,OPTIONS" } });
  if (request.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-operations"))) return json({ ok: true, service: "mandys-operations" });
  if (!allowedOrigin(request.headers.get("origin"))) return json({ error: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed" }, 403);
  try {
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);
    const ctx = ctxOrError;
    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);
    let result: Result;
    if (request.method === "GET" && path === "/v1/settings/profile") result = await readProfile(ctx);
    else if (request.method === "PUT" && path === "/v1/settings/profile") result = await saveProfile(ctx, await request.json().catch(() => null));
    else if (request.method === "GET" && path === "/v1/settings/operations") result = await readOperations(ctx);
    else if (request.method === "PUT" && path === "/v1/settings/opening-hours") result = await saveHours(ctx, await request.json().catch(() => null));
    else if (request.method === "POST" && path === "/v1/settings/dining-areas") result = await createArea(ctx, await request.json().catch(() => null));
    else if (request.method === "PATCH" && /^\/v1\/settings\/dining-areas\/[0-9a-f-]+$/i.test(path)) result = await updateArea(ctx, path.split("/")[4] ?? "", await request.json().catch(() => null));
    else if (request.method === "POST" && path === "/v1/settings/tables") result = await createTable(ctx, await request.json().catch(() => null));
    else if (request.method === "PATCH" && /^\/v1\/settings\/tables\/[0-9a-f-]+$/i.test(path)) result = await updateTable(ctx, path.split("/")[4] ?? "", await request.json().catch(() => null));
    else result = fail(404, "NOT_FOUND", "Route not found");
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-operations error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Operational settings could not be completed" }, 500);
  }
});