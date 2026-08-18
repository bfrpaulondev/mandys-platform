import { describe, expect, it } from "vitest";

import { operationalTargetFor } from "../../netlify/edge-functions/operational-runtime";

const cases = [
  ["menu", "mandys-menu", "/v1/menu"],
  ["reservations", "mandys-reservations", "/v1/reservations"],
  ["crm", "mandys-crm", "/v1/customers"],
  ["orders", "mandys-orders", "/v1/orders"],
  ["stock", "mandys-stock", "/v1/stock"],
  ["notifications", "mandys-notifications", "/v1/notifications"],
] as const;

describe("Netlify operational Edge routing", () => {
  it.each(cases)("maps %s to %s while preserving the runtime path", (prefix, service, runtimePath) => {
    const route = operationalTargetFor(
      new Request(`https://mandyplataform.netlify.app/api/${prefix}${runtimePath}?limit=25&filter=a%20b`),
    );

    expect(route?.service).toBe(service);
    expect(route?.target.origin).toBe("https://dbfmjdissqsdhxhmqkqp.supabase.co");
    expect(route?.target.pathname).toBe(`/functions/v1/${service}${runtimePath}`);
    expect(route?.target.searchParams.get("limit")).toBe("25");
    expect(route?.target.searchParams.get("filter")).toBe("a b");
  });

  it("preserves already encoded path segments without double encoding", () => {
    const route = operationalTargetFor(
      new Request("https://mandyplataform.netlify.app/api/menu/v1/items/caf%C3%A9%20do%20dia"),
    );

    expect(route?.target.pathname).toBe("/functions/v1/mandys-menu/v1/items/caf%C3%A9%20do%20dia");
  });

  it("rejects paths outside the explicit operational allowlist", () => {
    expect(operationalTargetFor(new Request("https://mandyplataform.netlify.app/api/auth/get-session"))).toBeNull();
    expect(operationalTargetFor(new Request("https://mandyplataform.netlify.app/api/data-protection/v1/export"))).toBeNull();
    expect(operationalTargetFor(new Request("https://mandyplataform.netlify.app/api/menu"))).toBeNull();
    expect(operationalTargetFor(new Request("https://mandyplataform.netlify.app/api/toString/v1/anything"))).toBeNull();
  });
});
