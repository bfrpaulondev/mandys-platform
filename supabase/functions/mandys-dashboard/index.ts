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
  connection: {
    application_name: "mandys-dashboard-edge",
    search_path: "mandys,public",
  },
});

type Context = { userId: string; organizationId: string; role: string };
type ContextResult =
  | { context: Context; authMs: number; membershipMs: number }
  | { status: number; body: unknown; authMs: number; membershipMs: number };

type Timing = {
  authMs?: number;
  membershipMs?: number;
  dbMs?: number;
  totalMs?: number;
};

function serverTiming(timing: Timing): string {
  const parts: string[] = [];
  if (timing.authMs !== undefined) parts.push(`mandys_auth;dur=${timing.authMs.toFixed(1)}`);
  if (timing.membershipMs !== undefined) parts.push(`mandys_member;dur=${timing.membershipMs.toFixed(1)}`);
  if (timing.dbMs !== undefined) parts.push(`mandys_db;dur=${timing.dbMs.toFixed(1)}`);
  if (timing.totalMs !== undefined) parts.push(`mandys_edge;dur=${timing.totalMs.toFixed(1)}`);
  return parts.join(", ");
}

function json(body: unknown, status = 200, timing: Timing = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  const value = serverTiming(timing);
  if (value) headers["server-timing"] = value;
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.protocol !== "https:") return false;
    return (
      url.hostname === "mandys.pt" ||
      url.hostname.endsWith(".mandys.pt") ||
      url.hostname.endsWith(".vercel.app") ||
      url.hostname.endsWith(".netlify.app")
    );
  } catch {
    return false;
  }
}

async function resolveContext(request: Request): Promise<ContextResult> {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return {
      status: 401,
      body: { error: "UNAUTHENTICATED", message: "Authentication is required" },
      authMs: 0,
      membershipMs: 0,
    };
  }

  const authStartedAt = performance.now();
  const response = await fetch(authSessionUrl, {
    method: "GET",
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  });
  const authMs = performance.now() - authStartedAt;
  if (!response.ok) {
    return {
      status: 401,
      body: { error: "UNAUTHENTICATED", message: "Session is invalid or expired" },
      authMs,
      membershipMs: 0,
    };
  }

  const body = (await response.json().catch(() => null)) as any;
  const userId = body?.user?.id;
  const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") {
    return {
      status: 401,
      body: { error: "TENANT_CONTEXT_REQUIRED", message: "Select an active restaurant organization" },
      authMs,
      membershipMs: 0,
    };
  }

  const membershipStartedAt = performance.now();
  const members = await sql<{ role: string }[]>`
    select role
    from mandys.member
    where organization_id = ${organizationId} and user_id = ${userId}
    limit 1
  `;
  const membershipMs = performance.now() - membershipStartedAt;
  const role = members[0]?.role;
  if (!role) {
    return {
      status: 403,
      body: { error: "FORBIDDEN", message: "Organization membership is required" },
      authMs,
      membershipMs,
    };
  }

  return { context: { userId, organizationId, role }, authMs, membershipMs };
}

async function dashboard(ctx: Context) {
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${ctx.organizationId}, true)`;
    const rows = await tx<any[]>`
      with active_location as (
        select id, name, is_active
        from mandys.locations
        where organization_id = ${ctx.organizationId}
        order by is_active desc, created_at asc
        limit 1
      ),
      profile as (
        select public_name
        from mandys.restaurant_profiles
        where organization_id = ${ctx.organizationId}
          and (
            location_id = (select id from active_location)
            or location_id is null
          )
        order by location_id nulls last, created_at asc
        limit 1
      ),
      today_reservations as (
        select id, guest_name, starts_at, party_size, status
        from mandys.reservations
        where organization_id = ${ctx.organizationId}
          and location_id = (select id from active_location)
          and (
            starts_at at time zone coalesce(
              (select timezone from mandys.tenant_settings where organization_id = ${ctx.organizationId} limit 1),
              'Europe/Lisbon'
            )
          )::date = (
            now() at time zone coalesce(
              (select timezone from mandys.tenant_settings where organization_id = ${ctx.organizationId} limit 1),
              'Europe/Lisbon'
            )
          )::date
          and status not in ('cancelled', 'no_show')
      )
      select
        (exists(select 1 from active_location) and exists(select 1 from profile)) as configured,
        coalesce(
          (select jsonb_build_object('publicName', public_name) from profile),
          'null'::jsonb
        ) as profile,
        coalesce(
          (select jsonb_build_object('id', id, 'name', name, 'isActive', is_active) from active_location),
          'null'::jsonb
        ) as active_location,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object('moduleKey', module_key, 'status', status)
              order by module_key
            )
            from mandys.module_entitlements
            where organization_id = ${ctx.organizationId}
          ),
          '[]'::jsonb
        ) as modules,
        jsonb_build_object(
          'reservationCount', (select count(*)::int from today_reservations),
          'guestCount', (select coalesce(sum(party_size), 0)::int from today_reservations),
          'nextReservation', (
            select jsonb_build_object(
              'id', id,
              'guestName', guest_name,
              'startsAt', starts_at,
              'partySize', party_size,
              'status', status
            )
            from today_reservations
            where starts_at >= now()
            order by starts_at asc
            limit 1
          )
        ) as today
    `;

    const row = rows[0] ?? {};
    return {
      data: {
        configured: Boolean(row.configured),
        currentRole: ctx.role,
        profile: row.profile ?? null,
        activeLocation: row.active_location ?? null,
        modules: Array.isArray(row.modules) ? row.modules : [],
        today: row.today ?? { reservationCount: 0, guestCount: 0, nextReservation: null },
        generatedAt: new Date().toISOString(),
      },
    };
  });
}

Deno.serve(async (request) => {
  const totalStartedAt = performance.now();
  const url = new URL(request.url);

  if (request.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/mandys-dashboard"))) {
    return json({ ok: true, service: "mandys-dashboard" });
  }

  if (!allowedOrigin(request.headers.get("origin"))) {
    return json({ error: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed" }, 403);
  }

  try {
    const ctxResult = await resolveContext(request);
    if ("body" in ctxResult) {
      return json(ctxResult.body, ctxResult.status, {
        authMs: ctxResult.authMs,
        membershipMs: ctxResult.membershipMs,
        totalMs: performance.now() - totalStartedAt,
      });
    }

    const marker = url.pathname.indexOf("/v1/");
    const path = marker === -1 ? "" : url.pathname.slice(marker);
    if (request.method !== "GET" || path !== "/v1/dashboard") {
      return json({ error: "NOT_FOUND", message: "Route not found" }, 404, {
        authMs: ctxResult.authMs,
        membershipMs: ctxResult.membershipMs,
        totalMs: performance.now() - totalStartedAt,
      });
    }

    const dbStartedAt = performance.now();
    const body = await dashboard(ctxResult.context);
    const dbMs = performance.now() - dbStartedAt;
    return json(body, 200, {
      authMs: ctxResult.authMs,
      membershipMs: ctxResult.membershipMs,
      dbMs,
      totalMs: performance.now() - totalStartedAt,
    });
  } catch (error) {
    console.error("mandys-dashboard error", error instanceof Error ? error.message : String(error));
    return json(
      { error: "INTERNAL_ERROR", message: "Dashboard could not be loaded" },
      500,
      { totalMs: performance.now() - totalStartedAt },
    );
  }
});
