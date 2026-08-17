const PORTAL_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-billing-portal";
const TRUSTED_GATEWAY_ORIGIN = "https://mandys.pt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("origin", TRUSTED_GATEWAY_ORIGIN);
  headers.set("x-mandys-gateway", "backoffice");

  try {
    const upstream = await fetch(PORTAL_UPSTREAM, {
      method: "POST",
      headers,
      body: await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
    });
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
        error: "BILLING_PORTAL_RUNTIME_UNAVAILABLE",
        message: "Mandy's billing portal is temporarily unavailable",
      },
      { status: 503 },
    );
  }
}
