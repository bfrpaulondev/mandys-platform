const OPERATIONS_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ all: string[] }>;
};

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${OPERATIONS_UPSTREAM}/${all.map(encodeURIComponent).join("/")}`);
  targetUrl.search = incomingUrl.search;

  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "origin", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-mandys-gateway", "backoffice");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-length");
    responseHeaders.delete("content-encoding");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        error: "OPERATIONS_RUNTIME_UNAVAILABLE",
        message: "Mandy's operations runtime is temporarily unavailable",
      },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
