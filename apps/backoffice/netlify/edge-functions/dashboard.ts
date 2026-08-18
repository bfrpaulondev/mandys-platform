const DASHBOARD_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-dashboard/v1/dashboard";

export default async function handler(request: Request): Promise<Response> {
  const startedAt = performance.now();
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: {
        "content-type": "application/json; charset=utf-8",
        allow: "GET",
        "cache-control": "no-store",
      },
    });
  }

  const upstreamHeaders = new Headers({ accept: "application/json" });
  const cookie = request.headers.get("cookie");
  if (cookie) upstreamHeaders.set("cookie", cookie);

  try {
    const response = await fetch(DASHBOARD_UPSTREAM, {
      method: "GET",
      headers: upstreamHeaders,
      cache: "no-store",
    });
    const body = await response.arrayBuffer();
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-mandys-proxy", "netlify-edge");
    const upstreamTiming = headers.get("server-timing");
    const proxyTiming = `mandys_netlify_edge;dur=${(performance.now() - startedAt).toFixed(1)}`;
    headers.set("server-timing", upstreamTiming ? `${upstreamTiming}, ${proxyTiming}` : proxyTiming);
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: "DASHBOARD_RUNTIME_UNAVAILABLE",
        message: "Mandy's dashboard is temporarily unavailable",
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-mandys-proxy": "netlify-edge",
          "server-timing": `mandys_netlify_edge;dur=${(performance.now() - startedAt).toFixed(1)}`,
        },
      },
    );
  }
}
