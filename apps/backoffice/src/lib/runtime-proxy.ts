const TRUSTED_GATEWAY_ORIGIN = "https://mandys.pt";

export type RuntimeProxyOptions = {
  service: string;
  unavailableCode: string;
  unavailableMessage: string;
};

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

function appendTiming(headers: Headers, upstreamMs: number, totalMs: number): void {
  const ownTiming = `mandys_upstream;dur=${upstreamMs.toFixed(1)}, mandys_gateway;dur=${totalMs.toFixed(1)}`;
  const upstreamTiming = headers.get("server-timing");
  headers.set("server-timing", upstreamTiming ? `${upstreamTiming}, ${ownTiming}` : ownTiming);
  headers.set("x-mandys-upstream-ms", upstreamMs.toFixed(1));
  headers.set("x-mandys-gateway-ms", totalMs.toFixed(1));
}

export async function forwardRuntimeRequest(
  request: Request,
  targetUrl: URL,
  options: RuntimeProxyOptions,
): Promise<Response> {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID();
  const headers = forwardedHeaders(request, traceId);
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstreamStartedAt = performance.now();
  try {
    const upstream = await fetch(targetUrl, init);
    const upstreamMs = performance.now() - upstreamStartedAt;
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-length");
    responseHeaders.delete("content-encoding");
    responseHeaders.set("x-mandys-trace-id", traceId);
    responseHeaders.set("x-mandys-service", options.service);
    appendTiming(responseHeaders, upstreamMs, performance.now() - startedAt);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    const upstreamMs = performance.now() - upstreamStartedAt;
    const responseHeaders = new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-mandys-trace-id": traceId,
      "x-mandys-service": options.service,
    });
    appendTiming(responseHeaders, upstreamMs, performance.now() - startedAt);

    return new Response(
      JSON.stringify({ error: options.unavailableCode, message: options.unavailableMessage }),
      { status: 503, headers: responseHeaders },
    );
  }
}

export function upstreamUrl(baseUrl: string, request: Request, segments: string[]): URL {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${baseUrl}/${segments.map(encodeURIComponent).join("/")}`);
  targetUrl.search = incomingUrl.search;
  return targetUrl;
}
