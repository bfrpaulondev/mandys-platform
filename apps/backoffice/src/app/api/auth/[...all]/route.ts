const AUTH_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-auth/api/auth";

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
