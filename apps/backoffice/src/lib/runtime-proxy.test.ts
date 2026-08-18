import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardRuntimeRequest } from "./runtime-proxy";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("runtime proxy instrumentation", () => {
  it("preserves upstream timing and appends gateway timing", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "server-timing": "mandys_db;dur=4.2",
      },
    })) as typeof fetch;

    const response = await forwardRuntimeRequest(
      new Request("https://mandys.example/api/dashboard", { headers: { cookie: "session=test" } }),
      new URL("https://runtime.example/v1/dashboard"),
      {
        service: "dashboard",
        unavailableCode: "UNAVAILABLE",
        unavailableMessage: "Unavailable",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("server-timing")).toContain("mandys_db;dur=4.2");
    expect(response.headers.get("server-timing")).toContain("mandys_upstream;dur=");
    expect(response.headers.get("server-timing")).toContain("mandys_gateway;dur=");
    expect(response.headers.get("x-mandys-trace-id")).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.headers.get("x-mandys-service")).toBe("dashboard");
  });

  it("returns a timed 503 when the upstream cannot be reached", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("network down"); }) as typeof fetch;

    const response = await forwardRuntimeRequest(
      new Request("https://mandys.example/api/dashboard"),
      new URL("https://runtime.example/v1/dashboard"),
      {
        service: "dashboard",
        unavailableCode: "UNAVAILABLE",
        unavailableMessage: "Unavailable",
      },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("server-timing")).toContain("mandys_gateway;dur=");
    expect(await response.json()).toEqual({ error: "UNAVAILABLE", message: "Unavailable" });
  });
});
