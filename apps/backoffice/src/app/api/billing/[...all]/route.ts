const BILLING_UPSTREAM = "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-billing";
const TRUSTED_GATEWAY_ORIGIN = "https://mandys.pt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ all: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  const { all } = await context.params;
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${BILLING_UPSTREAM}/${all.map(encodeURIComponent).join("/")}`);
  targetUrl.search = incomingUrl.search;
  const headers = new Headers();
  for (const name of ["accept", "cookie", "user-agent"]) { const value = request.headers.get(name); if (value) headers.set(name, value); }
  headers.set("origin", TRUSTED_GATEWAY_ORIGIN);
  headers.set("x-mandys-gateway", "backoffice");
  try {
    const upstream = await fetch(targetUrl, { method: "GET", headers, redirect: "manual", cache: "no-store" });
    const responseHeaders = new Headers(upstream.headers); responseHeaders.delete("content-length"); responseHeaders.delete("content-encoding");
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  } catch {
    return Response.json({ error: "BILLING_RUNTIME_UNAVAILABLE", message: "Mandy's billing runtime is temporarily unavailable" }, { status: 503 });
  }
}
