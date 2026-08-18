const SUPABASE_FUNCTIONS_ORIGIN = "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1";
const TRUSTED_GATEWAY_ORIGIN = "https://mandys.pt";

const services = new Map<string, string>([
  ["menu", "mandys-menu"],
  ["reservations", "mandys-reservations"],
  ["crm", "mandys-crm"],
  ["orders", "mandys-orders"],
  ["stock", "mandys-stock"],
  ["notifications", "mandys-notifications"],
]);

export const config = {
  path: [
    "/api/menu/*",
    "/api/reservations/*",
    "/api/crm/*",
    "/api/orders/*",
    "/api/stock/*",
    "/api/notifications/*",
  ],
};

function json(body: unknown, status: number, startedAt: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-mandys-proxy": "netlify-edge",
      "server-timing": `mandys_netlify_edge;dur=${(performance.now() - startedAt).toFixed(1)}`,
    },
  });
}

export function operationalTargetFor(request: Request): { target: URL; service: string } | null {
  const incoming = new URL(request.url);
  const segments = incoming.pathname.split("/").filter(Boolean);
  if (segments.length < 3 || segments[0] !== "api") return null;

  const serviceKey = segments[1];
  const service = services.get(serviceKey);
  if (!service) return null;

  // Preserve the browser's serialized path instead of decoding/re-encoding it.
  // IDs are usually UUIDs, but this also avoids double-encoding valid %xx paths.
  const prefix = `/api/${serviceKey}/`;
  if (!incoming.pathname.startsWith(prefix)) return null;
  const remaining = incoming.pathname.slice(prefix.length);
  if (!remaining) return null;

  const target = new URL(`${SUPABASE_FUNCTIONS_ORIGIN}/${service}/${remaining}`);
  target.search = incoming.search;
  return { target, service };
}

function forwardedHeaders(request: Request, traceId: string): Headers {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("origin", TRUSTED_GATEWAY_ORIGIN);
  headers.set("referer", `${TRUSTED_GATEWAY_ORIGIN}/`);
  headers.set("x-mandys-gateway", "backoffice");
  headers.set("x-mandys-trace-id", traceId);
  return headers;
}

export default async function handler(request: Request): Promise<Response> {
  const startedAt = performance.now();
  const route = operationalTargetFor(request);
  if (!route) return json({ error: "NOT_FOUND", message: "Route not found" }, 404, startedAt);

  const traceId = crypto.randomUUID();
  const init: RequestInit = {
    method: request.method,
    headers: forwardedHeaders(request, traceId),
    redirect: "manual",
    cache: "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstreamStartedAt = performance.now();
  try {
    const upstream = await fetch(route.target, init);
    const upstreamMs = performance.now() - upstreamStartedAt;
    const body = await upstream.arrayBuffer();
    const headers = new Headers(upstream.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.set("cache-control", "no-store");
    headers.set("x-mandys-proxy", "netlify-edge");
    headers.set("x-mandys-service", route.service);
    headers.set("x-mandys-trace-id", traceId);
    const ownTiming = `mandys_upstream;dur=${upstreamMs.toFixed(1)}, mandys_netlify_edge;dur=${(performance.now() - startedAt).toFixed(1)}`;
    const upstreamTiming = headers.get("server-timing");
    headers.set("server-timing", upstreamTiming ? `${upstreamTiming}, ${ownTiming}` : ownTiming);

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return json(
      { error: "RUNTIME_UNAVAILABLE", message: "Mandy's service is temporarily unavailable" },
      503,
      startedAt,
    );
  }
}
