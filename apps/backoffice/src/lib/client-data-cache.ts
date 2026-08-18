"use client";

type CachePolicy = {
  namespace: string;
  ttlMs: number;
};

type StoredResponse = {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  expiresAt: number;
};

const MAX_ENTRIES = 64;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const policies: Array<{ prefix: string; policy: CachePolicy }> = [
  { prefix: "/api/dashboard", policy: { namespace: "dashboard", ttlMs: 5_000 } },
  { prefix: "/api/reservations/", policy: { namespace: "reservations", ttlMs: 3_000 } },
  { prefix: "/api/orders/", policy: { namespace: "orders", ttlMs: 3_000 } },
  { prefix: "/api/stock/", policy: { namespace: "stock", ttlMs: 5_000 } },
  { prefix: "/api/crm/", policy: { namespace: "crm", ttlMs: 10_000 } },
  { prefix: "/api/menu/", policy: { namespace: "menu", ttlMs: 20_000 } },
  { prefix: "/api/runtime/v1/core", policy: { namespace: "core", ttlMs: 10_000 } },
];

export function cachePolicyForPath(pathname: string): CachePolicy | null {
  return policies.find((entry) => pathname.startsWith(entry.prefix))?.policy ?? null;
}

function responseFromStored(stored: StoredResponse, cacheState: "hit" | "miss" | "deduped"): Response {
  const headers = new Headers(stored.headers);
  headers.set("x-mandys-client-cache", cacheState);
  return new Response(stored.body.slice(0), {
    status: stored.status,
    statusText: stored.statusText,
    headers,
  });
}

async function snapshotResponse(response: Response, ttlMs: number): Promise<StoredResponse | null> {
  const clone = response.clone();
  const body = await clone.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) return null;
  return {
    body,
    status: response.status,
    statusText: response.statusText,
    headers: Array.from(response.headers.entries()),
    expiresAt: Date.now() + ttlMs,
  };
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit): { request: Request; url: URL } | null {
  try {
    const normalizedInput = typeof input === "string" ? new URL(input, window.location.origin) : input;
    const request = new Request(normalizedInput, init);
    const url = new URL(request.url, window.location.origin);
    return { request, url };
  } catch {
    return null;
  }
}

export function installBackofficeDataCache(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const extendedWindow = window as typeof window & { __mandysDataCacheCleanup?: () => void };
  if (extendedWindow.__mandysDataCacheCleanup) return () => undefined;

  const nativeFetch = window.fetch.bind(window);
  const cache = new Map<string, { namespace: string; response: StoredResponse }>();
  const inFlight = new Map<string, Promise<StoredResponse | null>>();

  function clearAll(): void {
    cache.clear();
    inFlight.clear();
  }

  function invalidate(namespace: string): void {
    for (const [key, entry] of cache) {
      if (entry.namespace === namespace || entry.namespace === "dashboard") cache.delete(key);
    }
  }

  function trim(): void {
    while (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) return;
      cache.delete(oldest);
    }
  }

  async function cachedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const details = requestDetails(input, init);
    if (!details || details.url.origin !== window.location.origin) return nativeFetch(input, init);

    const method = details.request.method.toUpperCase();
    const pathname = details.url.pathname;

    if (pathname.startsWith("/api/auth/") && method !== "GET" && method !== "HEAD") {
      clearAll();
      const response = await nativeFetch(input, init);
      clearAll();
      return response;
    }

    const policy = cachePolicyForPath(pathname);
    if (!policy) return nativeFetch(input, init);

    if (method !== "GET" && method !== "HEAD") {
      invalidate(policy.namespace);
      const response = await nativeFetch(input, init);
      invalidate(policy.namespace);
      return response;
    }

    if (details.request.headers.has("authorization")) return nativeFetch(input, init);
    if (details.request.cache === "reload") {
      invalidate(policy.namespace);
      return nativeFetch(input, init);
    }

    const accept = details.request.headers.get("accept") ?? "";
    const key = `${method}:${details.url.href}:accept=${accept}`;
    const cached = cache.get(key);
    if (cached && cached.response.expiresAt > Date.now()) {
      cache.delete(key);
      cache.set(key, cached);
      return responseFromStored(cached.response, "hit");
    }
    if (cached) cache.delete(key);

    const pending = inFlight.get(key);
    if (pending) {
      const stored = await pending;
      return stored ? responseFromStored(stored, "deduped") : nativeFetch(input, init);
    }

    const network = (async (): Promise<StoredResponse | null> => {
      const response = await nativeFetch(input, init);
      if (response.status === 401 || response.status === 403) clearAll();
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) return null;
      const stored = await snapshotResponse(response, policy.ttlMs);
      if (!stored) return null;
      if (response.ok) {
        cache.set(key, { namespace: policy.namespace, response: stored });
        trim();
      }
      return stored;
    })();

    inFlight.set(key, network);
    try {
      const stored = await network;
      return stored ? responseFromStored(stored, "miss") : nativeFetch(input, init);
    } finally {
      inFlight.delete(key);
    }
  }

  window.fetch = cachedFetch as typeof window.fetch;

  const cleanup = () => {
    clearAll();
    if (window.fetch === cachedFetch) window.fetch = nativeFetch;
    delete extendedWindow.__mandysDataCacheCleanup;
  };

  extendedWindow.__mandysDataCacheCleanup = cleanup;
  return cleanup;
}
