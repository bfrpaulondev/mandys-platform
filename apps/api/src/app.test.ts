import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Mandy's API", () => {
  it("exposes a no-store health endpoint", async () => {
    const app = await buildApp();
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "mandys-api",
    });
  });
});
