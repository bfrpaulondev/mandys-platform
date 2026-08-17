const AUTH_UPSTREAM =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-auth/api/auth";
const TRUSTED_GATEWAY_ORIGIN = "https://mandys.pt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ all: string[] }>;
};

type OrganizationListItem = { id?: unknown };

function upstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Browser traffic is same-origin to this Next.js gateway. Normalize the
  // upstream Origin/Referer to Mandy's canonical trusted origin so preview
  // hosts never need broad access at the authentication runtime itself.
  headers.set("origin", TRUSTED_GATEWAY_ORIGIN);
  headers.set("referer", `${TRUSTED_GATEWAY_ORIGIN}/`);
  headers.set("x-mandys-gateway", "backoffice");
  return headers;
}

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

function listedOrganizations(body: unknown): OrganizationListItem[] | null {
  if (Array.isArray(body)) return body as OrganizationListItem[];
  if (
    body &&
    typeof body === "object" &&
    "data" in body &&
    Array.isArray((body as { data?: unknown }).data)
  ) {
    return (body as { data: OrganizationListItem[] }).data;
  }
  return null;
}

async function ensureOrganizationMembership(
  request: Request,
  requestedOrganizationId: string,
): Promise<Response | null> {
  const headers = upstreamHeaders(request);
  headers.delete("content-type");

  let response: Response;
  try {
    response = await fetch(`${AUTH_UPSTREAM}/organization/list`, {
      method: "GET",
      headers,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json(
      {
        error: "AUTH_MEMBERSHIP_CHECK_UNAVAILABLE",
        message: "Organization membership could not be verified",
      },
      { status: 503 },
    );
  }

  if (!response.ok) {
    const responseHeaders = copyResponseHeaders(response.headers);
    // A failed membership read is not allowed to mutate browser auth cookies.
    responseHeaders.delete("set-cookie");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  }

  const body = (await response.json().catch(() => null)) as unknown;
  const organizations = listedOrganizations(body);
  if (!organizations) {
    return Response.json(
      {
        error: "AUTH_MEMBERSHIP_CHECK_INVALID",
        message: "Organization membership could not be verified",
      },
      { status: 503 },
    );
  }

  const isMember = organizations.some(
    (organization) => organization.id === requestedOrganizationId,
  );
  if (!isMember) {
    return Response.json(
      {
        error: "FORBIDDEN",
        message: "Organization membership is required",
      },
      { status: 403 },
    );
  }

  return null;
}

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { all } = await context.params;
  const path = all.join("/");
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${AUTH_UPSTREAM}/${all.map(encodeURIComponent).join("/")}`);
  targetUrl.search = incomingUrl.search;

  let requestBody: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    requestBody = await request.arrayBuffer();
  }

  // Better Auth persists the active organization in the session. Validate a
  // requested switch before forwarding it so a cross-tenant attempt cannot
  // disturb an otherwise valid activeOrganizationId.
  if (request.method === "POST" && path === "organization/set-active" && requestBody) {
    let requestedOrganizationId: unknown;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(requestBody)) as {
        organizationId?: unknown;
      };
      requestedOrganizationId = parsed.organizationId;
    } catch {
      return Response.json(
        { error: "INVALID_REQUEST", message: "A valid JSON request is required" },
        { status: 400 },
      );
    }

    if (typeof requestedOrganizationId === "string") {
      const membershipFailure = await ensureOrganizationMembership(
        request,
        requestedOrganizationId,
      );
      if (membershipFailure) return membershipFailure;
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers: upstreamHeaders(request),
    redirect: "manual",
    cache: "no-store",
  };
  if (requestBody !== undefined) init.body = requestBody;

  try {
    const upstream = await fetch(targetUrl, init);
    const responseHeaders = copyResponseHeaders(upstream.headers);

    // If Better Auth rejects a tenant switch for any reason, never let the
    // failed response replace or clear a previously valid session cookie.
    if (
      path === "organization/set-active" &&
      (upstream.status < 200 || upstream.status >= 300)
    ) {
      responseHeaders.delete("set-cookie");
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
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
