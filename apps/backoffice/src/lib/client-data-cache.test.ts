import { describe, expect, it } from "vitest";

import { cachePolicyForPath } from "./client-data-cache";

describe("backoffice client data cache policy", () => {
  it("caches the performance-critical read surfaces", () => {
    expect(cachePolicyForPath("/api/dashboard")?.namespace).toBe("dashboard");
    expect(cachePolicyForPath("/api/menu/v1/menu")?.namespace).toBe("menu");
    expect(cachePolicyForPath("/api/crm/v1/customers")?.namespace).toBe("crm");
    expect(cachePolicyForPath("/api/reservations/v1/reservations")?.namespace).toBe("reservations");
    expect(cachePolicyForPath("/api/orders/v1/orders")?.namespace).toBe("orders");
    expect(cachePolicyForPath("/api/stock/v1/stock")?.namespace).toBe("stock");
  });

  it("does not cache authentication or destructive data-protection routes", () => {
    expect(cachePolicyForPath("/api/auth/get-session")).toBeNull();
    expect(cachePolicyForPath("/api/data-protection/v1/export")).toBeNull();
  });

  it("keeps fast-changing operational data on short TTLs", () => {
    expect(cachePolicyForPath("/api/reservations/v1/reservations")?.ttlMs).toBeLessThanOrEqual(5_000);
    expect(cachePolicyForPath("/api/orders/v1/orders")?.ttlMs).toBeLessThanOrEqual(5_000);
    expect(cachePolicyForPath("/api/menu/v1/menu")?.ttlMs).toBeGreaterThan(5_000);
  });
});
