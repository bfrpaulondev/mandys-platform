const AUTH_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-auth/api/auth";
const TRUSTED_GATEWAY_ORIGIN = "https://mandys.pt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ all: string[] }>;
};

function copyResponseHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  headers.delete("content-length");
  headers.delete("content-encoding");

  const enhanced = source as Headers & { getSetCookie?: () => string[] };
  const cookies = enhanced.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    headers.delete("set-cookie");
    for (const cookie of cookies) headers.append("set-cookie", cookie);
  }

  return headers;
}

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${AUTH_UPSTREAM}/${all.map(encodeURIComponent).join("/")}`);
  targetUrl.search = incomingUrl.search;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("host");
  requestHeaders.delete("content-length");

  // Browser traffic is same-origin to this Next.js gateway. Normalize the
  // upstream Origin/Referer to Mandy's canonical trusted origin so preview
  // hosts (Netlify/Vercel/custom deployment URLs) never need broad wildcard
  // access at the authentication service itself.
  requestHeaders.set("origin", TRUSTED_GATEWAY_ORIGIN);
  requestHeaders.set("referer", `${TRUSTED_GATEWAY_ORIGIN}/`);
  requestHeaders.set("x-mandys-gateway", "backoffice");

  const init: RequestInit = {
    method: request.method,
    headers: requestHeaders,
    redirect: "manual",
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, init);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: copyResponseHeaders(upstream.headers),
    });
  } catch {
    return Response.json(
      {
        error: "AUTH_RUNTIME_UNAVAILABLE",
        message: "Authentication service is temporarily unavailable",
      },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
