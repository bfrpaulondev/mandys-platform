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
  connection: { application_name: "mandys-crm-edge", search_path: "mandys,public" },
});

type Locale = "pt-PT" | "pt-BR" | "en" | "es";
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

function text(value: unknown, max: number, required = false): string | null | undefined {
  if (value === null || value === undefined || value === "") return required ? undefined : null;
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  if ((required && next.length === 0) || next.length > max) return undefined;
  return next || null;
}

function email(value: unknown): string | null | undefined {
  const next = text(value, 254);
  if (next === null || next === undefined) return next;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) ? next.toLowerCase() : undefined;
}

function locale(value: unknown): Locale | undefined {
  return value === "pt-PT" || value === "pt-BR" || value === "en" || value === "es" ? value : undefined;
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

  const rows = await sql<{ role: string }[]>`
    select role from mandys.member
    where organization_id = ${organizationId} and user_id = ${userId}
    limit 1
  `;
  const role = rows[0]?.role;
  if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}

function canRead(ctx: Context): boolean {
  return ctx.role === "owner" || ctx.role === "manager" || ctx.role === "reception";
}

function canWrite(ctx: Context): boolean {
  return canRead(ctx);
}

async function audit(tx: any, ctx: Context, action: string, entityId: string, metadata: Record<string, unknown>) {
  await tx`
    insert into mandys.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (${ctx.organizationId}, ${ctx.userId}, ${action}, 'customer', ${entityId}, ${tx.json(metadata)})
  `;
}

function mapCustomer(row: any) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    preferredLocale: row.preferred_locale,
    notes: row.notes,
    marketingConsentAt: row.marketing_consent_at,
    createdAt: row.created_at,
    reservationCount: Number(row.reservation_count ?? 0),
    lastReservationAt: row.last_reservation_at ?? null,
  };
}

async function listCustomers(ctx: Context, url: URL): Promise<Result> {
  if (!canRead(ctx)) return fail(403, "FORBIDDEN", "Customer access is not allowed for this role");
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const pattern = `%${q}%`;
    const rows = q
      ? await tx<any[]>`
          select c.*,
            count(r.id)::int as reservation_count,
            max(r.starts_at) as last_reservation_at
          from mandys.customers c
          left join mandys.reservations r
            on r.organization_id = c.organization_id and r.customer_id = c.id
          where c.organization_id = ${ctx.organizationId}
            and (
              c.first_name ilike ${pattern}
              or coalesce(c.last_name, '') ilike ${pattern}
              or coalesce(c.email, '') ilike ${pattern}
              or coalesce(c.phone, '') ilike ${pattern}
            )
          group by c.id
          order by max(r.starts_at) desc nulls last, c.updated_at desc
          limit 100
        `
      : await tx<any[]>`
          select c.*,
            count(r.id)::int as reservation_count,
            max(r.starts_at) as last_reservation_at
          from mandys.customers c
          left join mandys.reservations r
            on r.organization_id = c.organization_id and r.customer_id = c.id
          where c.organization_id = ${ctx.organizationId}
          group by c.id
          order by max(r.starts_at) desc nulls last, c.updated_at desc
          limit 100
        `;
    return { body: { data: rows.map(mapCustomer) } };
  });
}

async function customerDetail(ctx: Context, id: string): Promise<Result> {
  if (!canRead(ctx)) return fail(403, "FORBIDDEN", "Customer access is not allowed for this role");
  if (!isUuid(id)) return fail(400, "INVALID_CUSTOMER", "Customer identifier is invalid");

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const rows = await tx<any[]>`
      select c.*,
        count(r.id)::int as reservation_count,
        max(r.starts_at) as last_reservation_at
      from mandys.customers c
      left join mandys.reservations r
        on r.organization_id = c.organization_id and r.customer_id = c.id
      where c.organization_id = ${ctx.organizationId} and c.id = ${id}::uuid
      group by c.id
      limit 1
    `;
    const row = rows[0];
    if (!row) return fail(404, "CUSTOMER_NOT_FOUND", "Customer was not found");

    const reservations = await tx<any[]>`
      select id, starts_at, party_size, status, source
      from mandys.reservations
      where organization_id = ${ctx.organizationId} and customer_id = ${id}::uuid
      order by starts_at desc
      limit 50
    `;

    return {
      body: {
        data: {
          ...mapCustomer(row),
          reservations: reservations.map((reservation: any) => ({
            id: reservation.id,
            startsAt: reservation.starts_at,
            partySize: reservation.party_size,
            status: reservation.status,
            source: reservation.source,
          })),
        },
      },
    };
  });
}

function parseCustomer(body: any) {
  const firstName = text(body?.firstName, 100, true);
  const lastName = text(body?.lastName, 100);
  const customerEmail = email(body?.email);
  const phone = text(body?.phone, 50);
  const preferredLocale = locale(body?.preferredLocale);
  const notes = text(body?.notes, 2000);
  const marketingConsent = body?.marketingConsent === true;
  if (!firstName || preferredLocale === undefined || [lastName, customerEmail, phone, notes].some((value) => value === undefined)) return null;
  return { firstName, lastName, email: customerEmail, phone, preferredLocale, notes, marketingConsent };
}

async function findDuplicate(tx: any, ctx: Context, customer: { email: string | null; phone: string | null }, excludeId?: string) {
  if (!customer.email && !customer.phone) return null;
  const rows = excludeId
    ? await tx<any[]>`
        select id from mandys.customers
        where organization_id = ${ctx.organizationId}
          and id <> ${excludeId}::uuid
          and ((${customer.email}::text is not null and lower(email) = lower(${customer.email})) or (${customer.phone}::text is not null and phone = ${customer.phone}))
        limit 1
      `
    : await tx<any[]>`
        select id from mandys.customers
        where organization_id = ${ctx.organizationId}
          and ((${customer.email}::text is not null and lower(email) = lower(${customer.email})) or (${customer.phone}::text is not null and phone = ${customer.phone}))
        limit 1
      `;
  return rows[0]?.id ?? null;
}

async function createCustomer(ctx: Context, body: any): Promise<Result> {
  if (!canWrite(ctx)) return fail(403, "FORBIDDEN", "Customer creation is not allowed for this role");
  const customer = parseCustomer(body);
  if (!customer) return fail(400, "INVALID_REQUEST", "Customer data is invalid");

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const duplicateId = await findDuplicate(tx, ctx, customer);
    if (duplicateId) return fail(409, "CUSTOMER_EXISTS", "A customer with this email or phone already exists");

    const rows = await tx<any[]>`
      insert into mandys.customers (
        organization_id, first_name, last_name, email, phone, preferred_locale,
        notes, marketing_consent_at, marketing_consent_source
      ) values (
        ${ctx.organizationId}, ${customer.firstName}, ${customer.lastName}, ${customer.email}, ${customer.phone}, ${customer.preferredLocale},
        ${customer.notes}, ${customer.marketingConsent ? new Date() : null}, ${customer.marketingConsent ? "backoffice" : null}
      )
      returning *
    `;
    const row = rows[0];
    await audit(tx, ctx, "customer.created", row.id, { email: customer.email, phone: customer.phone, marketingConsent: customer.marketingConsent });
    return { status: 201, body: { data: { ...mapCustomer(row), reservations: [] } } };
  });
}

async function updateCustomer(ctx: Context, id: string, body: any): Promise<Result> {
  if (!canWrite(ctx)) return fail(403, "FORBIDDEN", "Customer updates are not allowed for this role");
  if (!isUuid(id)) return fail(400, "INVALID_CUSTOMER", "Customer identifier is invalid");
  const customer = parseCustomer(body);
  if (!customer) return fail(400, "INVALID_REQUEST", "Customer data is invalid");

  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const current = await tx<any[]>`select id, marketing_consent_at from mandys.customers where organization_id = ${ctx.organizationId} and id = ${id}::uuid limit 1`;
    if (!current[0]) return fail(404, "CUSTOMER_NOT_FOUND", "Customer was not found");

    const duplicateId = await findDuplicate(tx, ctx, customer, id);
    if (duplicateId) return fail(409, "CUSTOMER_EXISTS", "Another customer with this email or phone already exists");

    const consentAt = customer.marketingConsent ? (current[0].marketing_consent_at ?? new Date()) : null;
    const rows = await tx<any[]>`
      update mandys.customers set
        first_name = ${customer.firstName},
        last_name = ${customer.lastName},
        email = ${customer.email},
        phone = ${customer.phone},
        preferred_locale = ${customer.preferredLocale},
        notes = ${customer.notes},
        marketing_consent_at = ${consentAt},
        marketing_consent_source = ${customer.marketingConsent ? "backoffice" : null},
        updated_at = now()
      where organization_id = ${ctx.organizationId} and id = ${id}::uuid
      returning *
    `;
    await audit(tx, ctx, "customer.updated", id, { email: customer.email, phone: customer.phone, marketingConsent: customer.marketingConsent });

    const reservations = await tx<any[]>`
      select id, starts_at, party_size, status, source
      from mandys.reservations
      where organization_id = ${ctx.organizationId} and customer_id = ${id}::uuid
      order by starts_at desc
      limit 50
    `;
    const stats = await tx<any[]>`
      select count(*)::int as reservation_count, max(starts_at) as last_reservation_at
      from mandys.reservations
      where organization_id = ${ctx.organizationId} and customer_id = ${id}::uuid
    `;
    const mapped = mapCustomer({ ...rows[0], ...stats[0] });
    return {
      body: {
        data: {
          ...mapped,
          reservations: reservations.map((reservation: any) => ({ id: reservation.id, startsAt: reservation.starts_at, partySize: reservation.party_size, status: reservation.status, source: reservation.source })),
        },
      },
    };
  });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { allow: "GET,POST,PUT,OPTIONS" } });
  if (request.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-crm"))) return json({ ok: true, service: "mandys-crm" });
  if (!allowedOrigin(request.headers.get("origin"))) return json({ error: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed" }, 403);

  try {
    const ctxOrError = await context(request);
    if ("body" in ctxOrError) return json(ctxOrError.body, ctxOrError.status ?? 400);
    const ctx = ctxOrError;
    const marker = url.pathname.indexOf("/v1/");
    if (marker === -1) return json({ error: "NOT_FOUND" }, 404);
    const path = url.pathname.slice(marker);

    let result: Result;
    if (request.method === "GET" && path === "/v1/customers") result = await listCustomers(ctx, url);
    else if (request.method === "POST" && path === "/v1/customers") result = await createCustomer(ctx, await request.json().catch(() => null));
    else {
      const match = path.match(/^\/v1\/customers\/([0-9a-f-]+)$/i);
      if (match && request.method === "GET") result = await customerDetail(ctx, match[1]);
      else if (match && request.method === "PUT") result = await updateCustomer(ctx, match[1], await request.json().catch(() => null));
      else result = fail(404, "NOT_FOUND", "Route not found");
    }
    return json(result.body, result.status ?? 200);
  } catch (error) {
    console.error("mandys-crm error", error instanceof Error ? error.message : String(error));
    return json({ error: "INTERNAL_ERROR", message: "Customer operation could not be completed" }, 500);
  }
});
