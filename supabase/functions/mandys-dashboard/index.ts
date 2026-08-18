import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const projectUrl = Deno.env.get("SUPABASE_URL") ?? "https://dbfmjdissqsdhxhmqkqp.supabase.co";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

const dashboardRpcUrl = `${projectUrl}/rest/v1/rpc/mandys_dashboard_snapshot`;

type Timing = {
  sessionMs?: number;
  rpcMs?: number;
  totalMs?: number;
};

type DashboardSnapshot = {
  authenticated?: boolean;
  organizationId?: string | null;
  role?: string | null;
  configured?: boolean;
  profile?: { publicName?: string } | null;
  activeLocation?: { id?: string; name?: string; isActive?: boolean } | null;
  modules?: Array<{ moduleKey: string; status: string }>;
  today?: {
    reservationCount?: number;
    guestCount?: number;
    nextReservation?: {
      id: string;
      guestName: string;
      startsAt: string;
      partySize: number;
      status: string;
    } | null;
  };
};

function serverTiming(timing: Timing): string {
  const parts: string[] = [];
  if (timing.sessionMs !== undefined) parts.push(`mandys_session;dur=${timing.sessionMs.toFixed(1)}`);
  if (timing.rpcMs !== undefined) parts.push(`mandys_rpc;dur=${timing.rpcMs.toFixed(1)}`);
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

async function readDashboard(token: string): Promise<DashboardSnapshot> {
  const response = await fetch(dashboardRpcUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_session_token: token }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null) as DashboardSnapshot | null;
  if (!response.ok || !body || typeof body !== "object") {
    throw new Error(`dashboard snapshot RPC failed (${response.status})`);
  }
  return body;
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
    const rpcStartedAt = performance.now();
    const snapshot = await readDashboard(token);
    const rpcMs = performance.now() - rpcStartedAt;

    if (!snapshot.authenticated) {
      return json(
        { error: "UNAUTHENTICATED", message: "Session is invalid or expired" },
        401,
        { sessionMs, rpcMs, totalMs: performance.now() - totalStartedAt },
      );
    }
    if (!snapshot.organizationId) {
      return json(
        { error: "TENANT_CONTEXT_REQUIRED", message: "Select an active restaurant organization" },
        401,
        { sessionMs, rpcMs, totalMs: performance.now() - totalStartedAt },
      );
    }
    if (!snapshot.role) {
      return json(
        { error: "FORBIDDEN", message: "Organization membership is required" },
        403,
        { sessionMs, rpcMs, totalMs: performance.now() - totalStartedAt },
      );
    }

    return json(
      {
        data: {
          configured: Boolean(snapshot.configured),
          currentRole: snapshot.role,
          profile: snapshot.profile ?? null,
          activeLocation: snapshot.activeLocation ?? null,
          modules: Array.isArray(snapshot.modules) ? snapshot.modules : [],
          today: snapshot.today ?? { reservationCount: 0, guestCount: 0, nextReservation: null },
          generatedAt: new Date().toISOString(),
        },
      },
      200,
      { sessionMs, rpcMs, totalMs: performance.now() - totalStartedAt },
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
