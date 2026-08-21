import { describe, expect, it } from "vitest";

import { classifyStorefrontResponseStatus } from "./storefront";

describe("storefront runtime policy", () => {
  it("accepts successful runtime responses", () => {
    expect(classifyStorefrontResponseStatus(200)).toBe("ok");
    expect(classifyStorefrontResponseStatus(204)).toBe("ok");
  });

  it("treats only an explicit missing restaurant as not found", () => {
    expect(classifyStorefrontResponseStatus(404)).toBe("not-found");
  });

  it("never converts runtime/auth/rate-limit/server failures into demo data", () => {
    for (const status of [400, 401, 403, 408, 429, 500, 502, 503, 504]) {
      expect(classifyStorefrontResponseStatus(status)).toBe("unavailable");
    }
  });
});
