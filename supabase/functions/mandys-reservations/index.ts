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
  connection: { application_name: "mandys-reservations-edge", search_path: "mandys,public" },
});

type Context = { userId: string; organizationId: string; role: string };
type Result = { status?: number; body: unknown };
type Slot = { startsAt: string; endsAt: string; available: boolean; remainingCapacity: number };

const transitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

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

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next.length >= min && next.length <= max ? next : null;
}

function email(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const next = value.trim().toLowerCase();
  return next.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) ? next : null;
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

async function context(request: Request): Promise<Context | Result> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return fail(401, "UNAUTHENTICATED", "Authentication is required");
  const response = await fetch(authSessionUrl, { headers: { cookie, accept: "application/json" }, cache: "no-store" });
  if (!response.ok) return fail(401, "UNAUTHENTICATED", "Session is invalid or expired");
  const body = await response.json().catch(() => null) as any;
  const userId = body?.user?.id;
  const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") {
    return fail(401, "TENANT_CONTEXT_REQUIRED", "Select an active restaurant organization");
  }
  const members = await sql<{ role: string }[]>`
    select role from mandys.member where organization_id = ${organizationId} and user_id = ${userId} limit 1
  `;
  const role = members[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}

function canRead(ctx: Context) {
  return ["owner", "manager", "reception", "kitchen", "staff"].includes(ctx.role);
}

function canWrite(ctx: Context) {
  return ["owner", "manager", "reception"].includes(ctx.role);
}

async function assertEnabled(tx: any, ctx: Context) {
  const rows = await tx<any[]>`
    select status from mandys.module_entitlements
    where organization_id = ${ctx.organizationId} and module_key = 'reservations' limit 1
  `;
  if (!rows[0] || rows[0].status === "disabled") throw new Error("RESERVATIONS_DISABLED");
}

async function audit(tx: any, ctx: Context, action: string, entityId: string | null, metadata: Record<string, unknown>) {
  await tx`
    insert into mandys.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (${ctx.organizationId}, ${ctx.userId}, ${action}, 'reservation', ${entityId}, ${tx.json(metadata)})
  `;
}

async function getConfig(tx: any, ctx: Context, locationId?: string | null) {
  const locationRows = locationId
    ? await tx<any[]>`
        select id, name from mandys.locations
        where organization_id = ${ctx.organizationId} and id = ${locationId}::uuid and is_active = true limit 1
      `
    : await tx<any[]>`
        select id, name from mandys.locations
        where organization_id = ${ctx.organizationId} and is_active = true order by created_at asc limit 1
      `;
  const location = locationRows[0];
  if (!location) return null;
  const [settingsRows, profileRows] = await Promise.all([
    tx<any[]>`select timezone from mandys.tenant_settings where organization_id = ${ctx.organizationId} limit 1`,
    tx<any[]>`
      select reservation_duration_minutes from mandys.restaurant_profiles
      where organization_id = ${ctx.organizationId} and location_id = ${location.id}::uuid limit 1
    `,
  ]);
  return {
    locationId: location.id as string,
    locationName: location.name as string,
    timezone: settingsRows[0]?.timezone ?? "Europe/Lisbon",
    durationMinutes: Math.max(30, Math.min(360, Number(profileRows[0]?.reservation_duration_minutes ?? 90))),
  };
}

async function openingBounds(tx: any, organizationId: string, locationId: string, timezone: string, localDate: string) {
  const rows = await tx<any[]>`
    with day_info as (select extract(dow from ${localDate}::date)::int as weekday),
    hours as (
      select oh.opens_at, oh.closes_at, oh.is_closed
      from mandys.opening_hours oh, day_info d
      where oh.organization_id = ${organizationId} and oh.location_id = ${locationId}::uuid and oh.weekday = d.weekday
      limit 1
    )
    select is_closed,
      case when is_closed or opens_at is null or closes_at is null then null
        else ((${localDate}::date + opens_at::time) at time zone ${timezone}) end as open_at,
      case when is_closed or opens_at is null or closes_at is null then null
        else (((${localDate}::date + closes_at::time) + case when closes_at::time <= opens_at::time then interval '1 day' else interval '0 day' end) at time zone ${timezone}) end as close_at
    from hours
  `;
  const row = rows[0];
  if (!row || row.is_closed || !row.open_at || !row.close_at) return null;
  return { openAt: new Date(row.open_at), closeAt: new Date(row.close_at) };
}

async function availability(ctx: Context, url: URL): Promise<Result> {
  if (!canRead(ctx)) return fail(403, "FORBIDDEN", "Your role cannot access reservations");
  const localDate = url.searchParams.get("date") ?? "";
  const partySize = Number(url.searchParams.get("partySize") ?? 2);
  const locationId = url.searchParams.get("locationId");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !Number.isInteger(partySize) || partySize < 1 || partySize > 100 || (locationId && !isUuid(locationId))) {
    return fail(400, "INVALID_QUERY", "Availability query is invalid");
  }

  return sql.begin(async tx => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    await assertEnabled(tx, ctx);
    const cfg = await getConfig(tx, ctx, locationId);
    if (!cfg) return fail(404, "LOCATION_NOT_FOUND", "Restaurant location is not available");
    const bounds = await openingBounds(tx, ctx.organizationId, cfg.locationId, cfg.timezone, localDate);
    if (!bounds) return { body: { data: { locationId: cfg.locationId, timezone: cfg.timezone, durationMinutes: cfg.durationMinutes, slots: [] } } };

    const tables = await tx<any[]>`
      select id, min_seats, max_seats from mandys.restaurant_tables
      where organization_id = ${ctx.organizationId} and location_id = ${cfg.locationId}::uuid and is_active = true
      order by max_seats asc, min_seats asc, created_at asc
    `;
    if (tables.length === 0 || !tables.some((table: any) => Number(table.max_seats) >= partySize)) {
      return { body: { data: { locationId: cfg.locationId, timezone: cfg.timezone, durationMinutes: cfg.durationMinutes, slots: [] } } };
    }

    const reservations = await tx<any[]>`
      select table_id, starts_at, ends_at, party_size from mandys.reservations
      where organization_id = ${ctx.organizationId} and location_id = ${cfg.locationId}::uuid
        and status in ('pending','confirmed','seated')
        and starts_at < ${bounds.closeAt.toISOString()}::timestamptz and ends_at > ${bounds.openAt.toISOString()}::timestamptz
    `;
    const totalCapacity = tables.reduce((sum: number, table: any) => sum + Number(table.max_seats), 0);
    const slots: Slot[] = [];
    const durationMs = cfg.durationMinutes * 60_000;
    for (let at = bounds.openAt.getTime(); at + durationMs <= bounds.closeAt.getTime(); at += 30 * 60_000) {
      const startsAt = new Date(at);
      const endsAt = new Date(at + durationMs);
      if (endsAt.getTime() <= Date.now()) continue;
      const overlapping = reservations.filter((row: any) => new Date(row.starts_at).getTime() < endsAt.getTime() && new Date(row.ends_at).getTime() > startsAt.getTime());
      const reservedCapacity = overlapping.reduce((sum: number, row: any) => sum + Number(row.party_size), 0);
      const occupied = new Set(overlapping.map((row: any) => row.table_id).filter(Boolean));
      const remainingCapacity = Math.max(0, totalCapacity - reservedCapacity);
      const hasFittingTable = tables.some((table: any) => !occupied.has(table.id) && Number(table.max_seats) >= partySize);
      slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), available: hasFittingTable && remainingCapacity >= partySize, remainingCapacity });
    }
    return { body: { data: { locationId: cfg.locationId, timezone: cfg.timezone, durationMinutes: cfg.durationMinutes, slots } } };
  }).catch(error => String(error).includes("RESERVATIONS_DISABLED")
    ? fail(403, "RESERVATIONS_DISABLED", "The reservations module is not enabled")
    : Promise.reject(error));
}

async function list(ctx: Context, url: URL): Promise<Result> {
  if (!canRead(ctx)) return fail(403, "FORBIDDEN", "Your role cannot access reservations");
  const locationId = url.searchParams.get("locationId");
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  if ((locationId && !isUuid(locationId)) || !Number.isInteger(limit)) return fail(400, "INVALID_QUERY", "Reservation filters are invalid");
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;
  if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime())) || (from && to && to <= from)) {
    return fail(400, "INVALID_QUERY", "Reservation date filters are invalid");
  }

  return sql.begin(async tx => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    await assertEnabled(tx, ctx);
    const rows = await tx<any[]>`
      select r.id, r.location_id, r.customer_id, r.dining_area_id, r.table_id,
        r.guest_name, r.guest_email, r.guest_phone, r.starts_at, r.ends_at,
        r.party_size, r.status, r.notes, r.source, r.created_at, r.updated_at,
        t.name as table_name, a.name as dining_area_name
      from mandys.reservations r
      left join mandys.restaurant_tables t on t.organization_id = r.organization_id and t.id = r.table_id
      left join mandys.dining_areas a on a.organization_id = r.organization_id and a.id = r.dining_area_id
      where r.organization_id = ${ctx.organizationId}
        and (${locationId}::text is null or r.location_id = ${locationId}::uuid)
        and (${from ? from.toISOString() : null}::timestamptz is null or r.ends_at > ${from ? from.toISOString() : null}::timestamptz)
        and (${to ? to.toISOString() : null}::timestamptz is null or r.starts_at < ${to ? to.toISOString() : null}::timestamptz)
      order by r.starts_at asc limit ${limit}
    `;
    return {
      body: {
        data: rows.map((row: any) => ({
          id: row.id,
          locationId: row.location_id,
          customerId: row.customer_id,
          diningAreaId: row.dining_area_id,
          diningAreaName: row.dining_area_name,
          tableId: row.table_id,
          tableName: row.table_name,
          guestName: row.guest_name,
          guestEmail: row.guest_email,
          guestPhone: row.guest_phone,
          startsAt: new Date(row.starts_at).toISOString(),
          endsAt: new Date(row.ends_at).toISOString(),
          partySize: row.party_size,
          status: row.status,
          notes: row.notes,
          source: row.source,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        })),
      },
    };
  }).catch(error => String(error).includes("RESERVATIONS_DISABLED")
    ? fail(403, "RESERVATIONS_DISABLED", "The reservations module is not enabled")
    : Promise.reject(error));
}

async function create(ctx: Context, body: any): Promise<Result> {
  if (!canWrite(ctx)) return fail(403, "FORBIDDEN", "Your role cannot create reservations");
  const locationId = body?.locationId;
  const guestName = text(body?.guestName, 2, 120);
  const guestEmail = email(body?.guestEmail);
  const guestPhone = body?.guestPhone ? text(body.guestPhone, 1, 40) : null;
  const notes = body?.notes ? text(body.notes, 1, 2000) : null;
  const startsAt = new Date(body?.startsAt);
  const partySize = Number(body?.partySize);
  const requestedTableId = body?.tableId ?? null;
  if (!isUuid(locationId) || !guestName || !Number.isFinite(startsAt.getTime()) || !Number.isInteger(partySize) || partySize < 1 || partySize > 100 || (body?.guestEmail && !guestEmail) || (body?.guestPhone && !guestPhone) || (requestedTableId && !isUuid(requestedTableId))) {
    return fail(400, "INVALID_REQUEST", "Reservation data is invalid");
  }

  return sql.begin(async tx => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    await assertEnabled(tx, ctx);
    await tx`select pg_advisory_xact_lock(hashtext(${ctx.organizationId}), hashtext(${locationId}))`;
    const cfg = await getConfig(tx, ctx, locationId);
    if (!cfg) return fail(404, "LOCATION_NOT_FOUND", "Restaurant location is not available");
    const localRows = await tx<any[]>`
      select to_char(${startsAt.toISOString()}::timestamptz at time zone ${cfg.timezone}, 'YYYY-MM-DD') as local_date,
             extract(minute from ${startsAt.toISOString()}::timestamptz at time zone ${cfg.timezone})::int as minute
    `;
    const localDate = localRows[0]?.local_date as string;
    if (![0, 30].includes(Number(localRows[0]?.minute ?? -1))) return fail(422, "INVALID_SLOT", "Reservations must start on a 30-minute slot");
    const bounds = await openingBounds(tx, ctx.organizationId, locationId, cfg.timezone, localDate);
    const endsAt = new Date(startsAt.getTime() + cfg.durationMinutes * 60_000);
    if (!bounds || startsAt < bounds.openAt || endsAt > bounds.closeAt) return fail(409, "SLOT_UNAVAILABLE", "The restaurant is closed at the selected time");

    const tables = await tx<any[]>`
      select id, dining_area_id, min_seats, max_seats from mandys.restaurant_tables
      where organization_id = ${ctx.organizationId} and location_id = ${locationId}::uuid and is_active = true
      order by max_seats asc, created_at asc
    `;
    const overlapping = await tx<any[]>`
      select table_id, party_size from mandys.reservations
      where organization_id = ${ctx.organizationId} and location_id = ${locationId}::uuid
        and status in ('pending','confirmed','seated')
        and starts_at < ${endsAt.toISOString()}::timestamptz and ends_at > ${startsAt.toISOString()}::timestamptz
    `;
    const totalCapacity = tables.reduce((sum: number, table: any) => sum + Number(table.max_seats), 0);
    const reservedCapacity = overlapping.reduce((sum: number, row: any) => sum + Number(row.party_size), 0);
    if (totalCapacity === 0 || reservedCapacity + partySize > totalCapacity) return fail(409, "SLOT_UNAVAILABLE", "No capacity is available for this time");
    const occupied = new Set(overlapping.map((row: any) => row.table_id).filter(Boolean));
    const table = requestedTableId
      ? tables.find((row: any) => row.id === requestedTableId && Number(row.max_seats) >= partySize && !occupied.has(row.id))
      : tables.find((row: any) => Number(row.max_seats) >= partySize && !occupied.has(row.id));
    if (!table) return fail(409, "SLOT_UNAVAILABLE", "No suitable table is available for this time");

    let customerId: string | null = null;
    if (guestEmail || guestPhone) {
      const existing = guestEmail
        ? await tx<any[]>`select id from mandys.customers where organization_id=${ctx.organizationId} and lower(email)=${guestEmail} limit 1`
        : await tx<any[]>`select id from mandys.customers where organization_id=${ctx.organizationId} and phone=${guestPhone} limit 1`;
      customerId = existing[0]?.id ?? null;
    }
    if (!customerId) {
      const parts = guestName.split(/\s+/);
      const firstName = parts.shift() ?? guestName;
      const lastName = parts.join(" ") || null;
      const createdCustomer = await tx<any[]>`
        insert into mandys.customers (organization_id, first_name, last_name, email, phone)
        values (${ctx.organizationId}, ${firstName}, ${lastName}, ${guestEmail}, ${guestPhone}) returning id
      `;
      customerId = createdCustomer[0]?.id ?? null;
    }

    const rows = await tx<any[]>`
      insert into mandys.reservations (
        organization_id, location_id, customer_id, dining_area_id, table_id,
        guest_name, guest_email, guest_phone, starts_at, ends_at, party_size, status, notes, source
      ) values (
        ${ctx.organizationId}, ${locationId}::uuid, ${customerId}::uuid, ${table.dining_area_id}::uuid, ${table.id}::uuid,
        ${guestName}, ${guestEmail}, ${guestPhone}, ${startsAt.toISOString()}::timestamptz, ${endsAt.toISOString()}::timestamptz,
        ${partySize}, 'pending', ${notes}, 'backoffice'
      ) returning id, starts_at, ends_at, status
    `;
    const created = rows[0];
    await audit(tx, ctx, "reservation.created", created.id, { locationId, tableId: table.id, partySize, startsAt: startsAt.toISOString() });
    return { status: 201, body: { data: { id: created.id, startsAt: new Date(created.starts_at).toISOString(), endsAt: new Date(created.ends_at).toISOString(), partySize, status: created.status, tableId: table.id } } };
  }).catch(error => String(error).includes("RESERVATIONS_DISABLED")
    ? fail(403, "RESERVATIONS_DISABLED", "The reservations module is not enabled")
    : Promise.reject(error));
}

async function changeStatus(ctx: Context, reservationId: string, body: any): Promise<Result> {
  if (!canWrite(ctx)) return fail(403, "FORBIDDEN", "Your role cannot update reservations");
  const status = typeof body?.status === "string" ? body.status : "";
  if (!isUuid(reservationId) || !Object.hasOwn(transitions, status)) return fail(400, "INVALID_REQUEST", "Reservation status update is invalid");
  return sql.begin(async tx => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    await assertEnabled(tx, ctx);
    const currentRows = await tx<any[]>`
      select id,status from mandys.reservations where organization_id=${ctx.organizationId} and id=${reservationId}::uuid limit 1
    `;
    const current = currentRows[0];
    if (!current) return fail(404, "NOT_FOUND", "Reservation not found");
    if (current.status === status) return { body: { data: { id: current.id, status } } };
    if (!(transitions[current.status] ?? []).includes(status)) return fail(422, "INVALID_TRANSITION", `Reservation status cannot transition from ${current.status} to ${status}`);
    const updated = await tx<any[]>`
      update mandys.reservations set status=${status}::mandys.reservation_status, updated_at=now()
      where organization_id=${ctx.organizationId} and id=${reservationId}::uuid and status=${current.status}::mandys.reservation_status
      returning id,status
    `;
    if (!updated[0]) return fail(409, "CONCURRENT_UPDATE", "Reservation was updated by another request");
    await audit(tx, ctx, "reservation.status_changed", reservationId, { from: current.status, to: status });
    return { body: { data: { id: reservationId, status } } };
  }).catch(error => String(error).includes("RESERVATIONS_DISABLED")
    ? fail(403, "RESERVATIONS_DISABLED", "The reservations module is not enabled")
    : Promise.reject(error));
}

Deno.serve(async request => {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { allow: "GET,POST,PATCH,OPTIONS" } });
  if (request.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-reservations"))) return json({ ok: true, service: "mandys-reservations" });
  if (!allowedOrigin(request.headers.get("origin"))) return json({ error: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed" }, 403);
  try {
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);
    const ctx = ctxOrError;
    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);
    let result: Result;
    if (request.method === "GET" && path === "/v1/reservations") result = await list(ctx, url);
    else if (request.method === "GET" && path === "/v1/availability") result = await availability(ctx, url);
    else if (request.method === "POST" && path === "/v1/reservations") result = await create(ctx, await request.json().catch(() => null));
    else if (request.method === "PATCH" && /^\/v1\/reservations\/[0-9a-f-]+\/status$/i.test(path)) {
      const reservationId = path.split("/")[3] ?? "";
      result = await changeStatus(ctx, reservationId, await request.json().catch(() => null));
    } else result = fail(404, "NOT_FOUND", "Route not found");
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-reservations error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Reservation operation could not be completed" }, 500);
  }
});
