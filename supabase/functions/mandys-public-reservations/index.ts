import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const connectionString = Deno.env.get("SUPABASE_DB_URL");
if (!connectionString) throw new Error("SUPABASE_DB_URL is required");

const sql = postgres(connectionString, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: { application_name: "mandys-public-reservations-edge", search_path: "mandys,public" },
});

const supportedLocales = new Set(["pt-PT", "pt-BR", "en", "es"]);
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

type Result = { status?: number; body: unknown };
type Config = { organizationId: string; locationId: string; timezone: string; durationMinutes: number };

type Slot = { startsAt: string; endsAt: string; available: boolean; remainingCapacity: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function normalizeHostname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0];
  return normalized && normalized.length <= 253 ? normalized : null;
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

function locale(value: unknown) {
  return typeof value === "string" && supportedLocales.has(value) ? value : "pt-PT";
}

async function clientHash(req: Request): Promise<string> {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest)).slice(0, 12).map(value => value.toString(16).padStart(2, "0")).join("");
}

async function resolveConfig(hostname: string): Promise<Config | null> {
  const rows = await sql<any[]>`
    select d.organization_id
    from mandys.domains d
    where d.hostname = ${hostname} and d.verified_at is not null
    limit 1
  `;
  const organizationId = rows[0]?.organization_id;
  if (!organizationId) return null;

  return sql.begin(async tx => {
    await tx`select set_config('app.organization_id', ${organizationId}, true)`;
    const [entitlementRows, locationRows, settingsRows] = await Promise.all([
      tx<any[]>`select status from mandys.module_entitlements where organization_id=${organizationId} and module_key='reservations' limit 1`,
      tx<any[]>`select id from mandys.locations where organization_id=${organizationId} and is_active=true order by created_at asc limit 1`,
      tx<any[]>`select timezone from mandys.tenant_settings where organization_id=${organizationId} limit 1`,
    ]);
    if (!entitlementRows[0] || entitlementRows[0].status === "disabled" || !locationRows[0]) return null;
    const locationId = locationRows[0].id as string;
    const profileRows = await tx<any[]>`
      select reservation_duration_minutes from mandys.restaurant_profiles
      where organization_id=${organizationId} and location_id=${locationId}::uuid limit 1
    `;
    return {
      organizationId,
      locationId,
      timezone: settingsRows[0]?.timezone ?? "Europe/Lisbon",
      durationMinutes: Math.max(30, Math.min(360, Number(profileRows[0]?.reservation_duration_minutes ?? 90))),
    };
  });
}

async function openingBounds(tx: any, cfg: Config, localDate: string) {
  const rows = await tx<any[]>`
    with day_info as (select extract(dow from ${localDate}::date)::int as weekday),
    hours as (
      select oh.opens_at, oh.closes_at, oh.is_closed
      from mandys.opening_hours oh, day_info d
      where oh.organization_id=${cfg.organizationId} and oh.location_id=${cfg.locationId}::uuid and oh.weekday=d.weekday
      limit 1
    )
    select is_closed,
      case when is_closed or opens_at is null or closes_at is null then null else ((${localDate}::date + opens_at::time) at time zone ${cfg.timezone}) end as open_at,
      case when is_closed or opens_at is null or closes_at is null then null else ((( ${localDate}::date + closes_at::time) + case when closes_at::time <= opens_at::time then interval '1 day' else interval '0 day' end) at time zone ${cfg.timezone}) end as close_at
    from hours
  `;
  const row = rows[0];
  if (!row || row.is_closed || !row.open_at || !row.close_at) return null;
  return { openAt: new Date(row.open_at), closeAt: new Date(row.close_at) };
}

async function computeSlots(cfg: Config, localDate: string, partySize: number): Promise<Slot[]> {
  return sql.begin(async tx => {
    await tx`select set_config('app.organization_id', ${cfg.organizationId}, true)`;
    const bounds = await openingBounds(tx, cfg, localDate);
    if (!bounds) return [];
    const tables = await tx<any[]>`
      select id,max_seats from mandys.restaurant_tables
      where organization_id=${cfg.organizationId} and location_id=${cfg.locationId}::uuid and is_active=true
      order by max_seats asc, created_at asc
    `;
    if (tables.length === 0 || !tables.some((table: any) => Number(table.max_seats) >= partySize)) return [];
    const bookings = await tx<any[]>`
      select table_id,starts_at,ends_at,party_size from mandys.reservations
      where organization_id=${cfg.organizationId} and location_id=${cfg.locationId}::uuid
        and status in ('pending','confirmed','seated')
        and starts_at < ${bounds.closeAt.toISOString()}::timestamptz
        and ends_at > ${bounds.openAt.toISOString()}::timestamptz
    `;
    const totalCapacity = tables.reduce((sum: number, table: any) => sum + Number(table.max_seats), 0);
    const durationMs = cfg.durationMinutes * 60_000;
    const slots: Slot[] = [];
    for (let at = bounds.openAt.getTime(); at + durationMs <= bounds.closeAt.getTime(); at += 30 * 60_000) {
      const startsAt = new Date(at); const endsAt = new Date(at + durationMs);
      if (startsAt.getTime() < Date.now() + 5 * 60_000) continue;
      const overlapping = bookings.filter((row: any) => new Date(row.starts_at).getTime() < endsAt.getTime() && new Date(row.ends_at).getTime() > startsAt.getTime());
      const occupied = new Set(overlapping.map((row: any) => row.table_id).filter(Boolean));
      const reservedCapacity = overlapping.reduce((sum: number, row: any) => sum + Number(row.party_size), 0);
      const remainingCapacity = Math.max(0, totalCapacity - reservedCapacity);
      const hasTable = tables.some((table: any) => !occupied.has(table.id) && Number(table.max_seats) >= partySize);
      slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), available: hasTable && remainingCapacity >= partySize, remainingCapacity });
    }
    return slots;
  });
}

async function rateLimit(tx: any, key: string, max: number): Promise<boolean> {
  const rows = await tx<any[]>`
    insert into mandys.public_request_limits (key, window_started_at, request_count, updated_at)
    values (${key}, now(), 1, now())
    on conflict (key) do update set
      request_count = case when mandys.public_request_limits.window_started_at < now() - interval '1 minute' then 1 else mandys.public_request_limits.request_count + 1 end,
      window_started_at = case when mandys.public_request_limits.window_started_at < now() - interval '1 minute' then now() else mandys.public_request_limits.window_started_at end,
      updated_at = now()
    returning request_count
  `;
  return Number(rows[0]?.request_count ?? 1) <= max;
}

async function availability(req: Request, url: URL): Promise<Result> {
  const hostname = normalizeHostname(url.searchParams.get("hostname"));
  const localDate = url.searchParams.get("date") ?? "";
  const partySize = Number(url.searchParams.get("partySize") ?? 2);
  if (!hostname || !/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
    return { status: 400, body: { error: "INVALID_QUERY", message: "Availability query is invalid" } };
  }
  const cfg = await resolveConfig(hostname);
  if (!cfg) return { status: 404, body: { error: "RESERVATIONS_UNAVAILABLE" } };
  const hash = await clientHash(req);
  const allowed = await sql.begin(async tx => rateLimit(tx, `public-availability:${cfg.organizationId}:${hash}`, 60));
  if (!allowed) return { status: 429, body: { error: "RATE_LIMITED" } };
  const slots = await computeSlots(cfg, localDate, partySize);
  return { body: { data: { timezone: cfg.timezone, durationMinutes: cfg.durationMinutes, slots } } };
}

async function create(req: Request, body: any): Promise<Result> {
  const hostname = normalizeHostname(body?.hostname);
  const startsAt = new Date(body?.startsAt);
  const partySize = Number(body?.partySize);
  const guestName = text(body?.guestName, 2, 120);
  const guestEmail = email(body?.guestEmail);
  const guestPhone = body?.guestPhone ? text(body.guestPhone, 1, 40) : null;
  const notes = body?.notes ? text(body.notes, 1, 2000) : null;
  if (!hostname || !Number.isFinite(startsAt.getTime()) || !Number.isInteger(partySize) || partySize < 1 || partySize > 100 || !guestName || (body?.guestEmail && !guestEmail) || (body?.guestPhone && !guestPhone)) {
    return { status: 400, body: { error: "INVALID_REQUEST", message: "Reservation data is invalid" } };
  }
  const cfg = await resolveConfig(hostname);
  if (!cfg) return { status: 404, body: { error: "RESERVATIONS_UNAVAILABLE" } };
  const hash = await clientHash(req);

  return sql.begin(async tx => {
    await tx`select set_config('app.organization_id', ${cfg.organizationId}, true)`;
    if (!(await rateLimit(tx, `public-reservation:${cfg.organizationId}:${hash}`, 12))) return { status: 429, body: { error: "RATE_LIMITED" } };
    await tx`select pg_advisory_xact_lock(hashtext(${cfg.organizationId}), hashtext(${cfg.locationId}))`;

    const localRows = await tx<any[]>`
      select to_char(${startsAt.toISOString()}::timestamptz at time zone ${cfg.timezone}, 'YYYY-MM-DD') as local_date,
             extract(minute from ${startsAt.toISOString()}::timestamptz at time zone ${cfg.timezone})::int as minute
    `;
    const localDate = localRows[0]?.local_date as string;
    if (![0, 30].includes(Number(localRows[0]?.minute ?? -1))) return { status: 422, body: { error: "INVALID_SLOT" } };
    const bounds = await openingBounds(tx, cfg, localDate);
    const endsAt = new Date(startsAt.getTime() + cfg.durationMinutes * 60_000);
    if (!bounds || startsAt < bounds.openAt || endsAt > bounds.closeAt || startsAt.getTime() < Date.now() + 5 * 60_000) {
      return { status: 409, body: { error: "SLOT_UNAVAILABLE" } };
    }

    const tables = await tx<any[]>`
      select id,dining_area_id,max_seats from mandys.restaurant_tables
      where organization_id=${cfg.organizationId} and location_id=${cfg.locationId}::uuid and is_active=true
      order by max_seats asc, created_at asc
    `;
    const overlapping = await tx<any[]>`
      select table_id,party_size from mandys.reservations
      where organization_id=${cfg.organizationId} and location_id=${cfg.locationId}::uuid
        and status in ('pending','confirmed','seated')
        and starts_at < ${endsAt.toISOString()}::timestamptz and ends_at > ${startsAt.toISOString()}::timestamptz
    `;
    const totalCapacity = tables.reduce((sum: number, table: any) => sum + Number(table.max_seats), 0);
    const reservedCapacity = overlapping.reduce((sum: number, row: any) => sum + Number(row.party_size), 0);
    const occupied = new Set(overlapping.map((row: any) => row.table_id).filter(Boolean));
    const table = tables.find((row: any) => !occupied.has(row.id) && Number(row.max_seats) >= partySize);
    if (!table || totalCapacity === 0 || reservedCapacity + partySize > totalCapacity) return { status: 409, body: { error: "SLOT_UNAVAILABLE" } };

    let customerId: string | null = null;
    if (guestEmail || guestPhone) {
      const existing = guestEmail
        ? await tx<any[]>`select id from mandys.customers where organization_id=${cfg.organizationId} and lower(email)=${guestEmail} limit 1`
        : await tx<any[]>`select id from mandys.customers where organization_id=${cfg.organizationId} and phone=${guestPhone} limit 1`;
      customerId = existing[0]?.id ?? null;
    }
    if (!customerId) {
      const parts = guestName.split(/\s+/); const firstName = parts.shift() ?? guestName; const lastName = parts.join(" ") || null;
      const customer = await tx<any[]>`
        insert into mandys.customers (organization_id,first_name,last_name,email,phone,preferred_locale)
        values (${cfg.organizationId},${firstName},${lastName},${guestEmail},${guestPhone},${locale(body?.locale)}::mandys.locale_code)
        returning id
      `;
      customerId = customer[0]?.id ?? null;
    }

    const createdRows = await tx<any[]>`
      insert into mandys.reservations (
        organization_id,location_id,customer_id,dining_area_id,table_id,guest_name,guest_email,guest_phone,
        starts_at,ends_at,party_size,status,notes,source
      ) values (
        ${cfg.organizationId},${cfg.locationId}::uuid,${customerId}::uuid,${table.dining_area_id}::uuid,${table.id}::uuid,
        ${guestName},${guestEmail},${guestPhone},${startsAt.toISOString()}::timestamptz,${endsAt.toISOString()}::timestamptz,
        ${partySize},'pending',${notes},'storefront'
      ) returning id,starts_at,ends_at,party_size,status
    `;
    const created = createdRows[0];
    await tx`
      insert into mandys.audit_logs (organization_id,action,entity_type,entity_id,ip_hash,metadata)
      values (${cfg.organizationId},'reservation.public_created','reservation',${created.id},${hash},${tx.json({ locationId: cfg.locationId, tableId: table.id, partySize, startsAt: startsAt.toISOString() })})
    `;
    return { status: 201, body: { data: { id: created.id, startsAt: new Date(created.starts_at).toISOString(), endsAt: new Date(created.ends_at).toISOString(), partySize: created.party_size, status: created.status } } };
  });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-public-reservations"))) return json({ ok: true, service: "mandys-public-reservations" });
    if (req.method === "GET" && url.pathname.endsWith("/v1/public/availability")) {
      const result = await availability(req, url); return json(result.body, result.status ?? 200);
    }
    if (req.method === "POST" && url.pathname.endsWith("/v1/public/reservations")) {
      const body = await req.json().catch(() => null); if (!body) return json({ error: "INVALID_JSON" }, 400);
      const result = await create(req, body); return json(result.body, result.status ?? 200);
    }
    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    console.error("mandys-public-reservations error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
