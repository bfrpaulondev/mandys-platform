import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const connectionString = Deno.env.get("SUPABASE_DB_URL");
if (!connectionString) throw new Error("SUPABASE_DB_URL is required");

const sql = postgres(connectionString, {
  prepare: false,
  max: 4,
  idle_timeout: 30,
  connect_timeout: 8,
  connection: {
    application_name: "mandys-dashboard-edge",
    search_path: "mandys,public",
  },
});

type Timing = {
  sessionMs?: number;
  dbMs?: number;
  totalMs?: number;
};

type DashboardRow = {
  authenticated: boolean;
  organization_id: string | null;
  role: string | null;
  configured: boolean;
  profile: { publicName?: string } | null;
  active_location: { id?: string; name?: string; isActive?: boolean } | null;
  modules: Array<{ moduleKey: string; status: string }> | null;
  today: {
    reservationCount?: number;
    guestCount?: number;
    nextReservation?: {
      id: string;
      guestName: string;
      startsAt: string;
      partySize: number;
      status: string;
    } | null;
  } | null;
};

function serverTiming(timing: Timing): string {
  const parts: string[] = [];
  if (timing.sessionMs !== undefined) parts.push(`mandys_session;dur=${timing.sessionMs.toFixed(1)}`);
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

function sessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const acceptedNames = new Set(["__Secure-mandys.session_token", "mandys.session_token"]);
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    if (!acceptedNames.has(name)) continue;

    const encoded = pair.slice(separator + 1).trim();
    let value = encoded;
    try {
      value = decodeURIComponent(encoded);
    } catch {
      // Keep the original value; an exact database lookup will reject invalid tokens.
    }

    const signatureSeparator = value.indexOf(".");
    const token = signatureSeparator > 0 ? value.slice(0, signatureSeparator) : value;
    return token.length >= 20 ? token : null;
  }
  return null;
}

async function readDashboard(token: string): Promise<DashboardRow> {
  const rows = await sql<DashboardRow[]>`
    with session_ctx as materialized (
      select
        s.user_id,
        s.active_organization_id as organization_id
      from mandys.session s
      where s.token = ${token}
        and s.expires_at > now()
      order by s.updated_at desc
      limit 1
    ),
    member_ctx as materialized (
      select m.role
      from session_ctx s
      join mandys.member m
        on m.organization_id = s.organization_id
       and m.user_id = s.user_id
      limit 1
    ),
    active_location as materialized (
      select l.id, l.name, l.is_active
      from mandys.locations l
      where l.organization_id = (select organization_id from session_ctx)
      order by l.is_active desc, l.created_at asc
      limit 1
    ),
    tenant_timezone as materialized (
      select coalesce(ts.timezone, 'Europe/Lisbon') as timezone
      from session_ctx s
      left join mandys.tenant_settings ts
        on ts.organization_id = s.organization_id
      limit 1
    ),
    profile as materialized (
      select rp.public_name
      from mandys.restaurant_profiles rp
      where rp.organization_id = (select organization_id from session_ctx)
        and (
          rp.location_id = (select id from active_location)
          or rp.location_id is null
        )
      order by rp.location_id nulls last, rp.created_at asc
      limit 1
    ),
    today_reservations as materialized (
      select r.id, r.guest_name, r.starts_at, r.party_size, r.status
      from mandys.reservations r
      where r.organization_id = (select organization_id from session_ctx)
        and r.location_id = (select id from active_location)
        and (r.starts_at at time zone (select timezone from tenant_timezone))::date =
            (now() at time zone (select timezone from tenant_timezone))::date
        and r.status not in ('cancelled', 'no_show')
    )
    select
      exists(select 1 from session_ctx) as authenticated,
      (select organization_id from session_ctx) as organization_id,
      (select role from member_ctx) as role,
      (exists(select 1 from active_location) and exists(select 1 from profile)) as configured,
      coalesce(
        (select jsonb_build_object('publicName', public_name) from profile),
        'null'::jsonb
      ) as profile,
      coalesce(
        (
          select jsonb_build_object('id', id, 'name', name, 'isActive', is_active)
          from active_location
        ),
        'null'::jsonb
      ) as active_location,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('moduleKey', me.module_key, 'status', me.status)
            order by me.module_key
          )
          from mandys.module_entitlements me
          where me.organization_id = (select organization_id from session_ctx)
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

  return rows[0] ?? {
    authenticated: false,
    organization_id: null,
    role: null,
    configured: false,
    profile: null,
    active_location: null,
    modules: [],
    today: { reservationCount: 0, guestCount: 0, nextReservation: null },
  };
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

  const marker = url.pathname.indexOf("/v1/");
  const path = marker === -1 ? "" : url.pathname.slice(marker);
  if (request.method !== "GET" || path !== "/v1/dashboard") {
    return json(
      { error: "NOT_FOUND", message: "Route not found" },
      404,
      { totalMs: performance.now() - totalStartedAt },
    );
  }

  const sessionStartedAt = performance.now();
  const token = sessionToken(request);
  const sessionMs = performance.now() - sessionStartedAt;
  if (!token) {
    return json(
      { error: "UNAUTHENTICATED", message: "Authentication is required" },
      401,
      { sessionMs, totalMs: performance.now() - totalStartedAt },
    );
  }

  try {
    const dbStartedAt = performance.now();
    const row = await readDashboard(token);
    const dbMs = performance.now() - dbStartedAt;

    if (!row.authenticated) {
      return json(
        { error: "UNAUTHENTICATED", message: "Session is invalid or expired" },
        401,
        { sessionMs, dbMs, totalMs: performance.now() - totalStartedAt },
      );
    }
    if (!row.organization_id) {
      return json(
        { error: "TENANT_CONTEXT_REQUIRED", message: "Select an active restaurant organization" },
        401,
        { sessionMs, dbMs, totalMs: performance.now() - totalStartedAt },
      );
    }
    if (!row.role) {
      return json(
        { error: "FORBIDDEN", message: "Organization membership is required" },
        403,
        { sessionMs, dbMs, totalMs: performance.now() - totalStartedAt },
      );
    }

    return json(
      {
        data: {
          configured: Boolean(row.configured),
          currentRole: row.role,
          profile: row.profile ?? null,
          activeLocation: row.active_location ?? null,
          modules: Array.isArray(row.modules) ? row.modules : [],
          today: row.today ?? { reservationCount: 0, guestCount: 0, nextReservation: null },
          generatedAt: new Date().toISOString(),
        },
      },
      200,
      { sessionMs, dbMs, totalMs: performance.now() - totalStartedAt },
    );
  } catch (error) {
    console.error("mandys-dashboard error", error instanceof Error ? error.message : String(error));
    return json(
      { error: "INTERNAL_ERROR", message: "Dashboard could not be loaded" },
      500,
      { sessionMs, totalMs: performance.now() - totalStartedAt },
    );
  }
});
