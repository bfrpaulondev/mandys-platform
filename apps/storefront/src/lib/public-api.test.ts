import { afterEach, describe, expect, it } from "vitest";

import {
  getPublicApiUrl,
  normalizeStorefrontHost,
  resolveStorefrontHostname,
} from "./public-api";

const originalApiUrl = process.env.MANDYS_API_URL;
const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalStorefrontHostname = process.env.MANDYS_STOREFRONT_HOSTNAME;

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.MANDYS_API_URL;
  else process.env.MANDYS_API_URL = originalApiUrl;

  if (originalPublicApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl;

  if (originalStorefrontHostname === undefined) delete process.env.MANDYS_STOREFRONT_HOSTNAME;
  else process.env.MANDYS_STOREFRONT_HOSTNAME = originalStorefrontHostname;
});

describe("storefront runtime resolution", () => {
  it("normalizes forwarded hosts safely", () => {
    expect(normalizeStorefrontHost(" Restaurant.Example:443 ")).toBe("restaurant.example");
    expect(normalizeStorefrontHost(null)).toBeNull();
  });

  it("uses the live Maré demo tenant on deployment previews and localhost", () => {
    delete process.env.MANDYS_STOREFRONT_HOSTNAME;
    expect(resolveStorefrontHostname("preview-abc.vercel.app")).toBe("demo.mandys.local");
    expect(resolveStorefrontHostname("mandy-store-front.netlify.app")).toBe(
      "demo.mandys.local",
    );
    expect(resolveStorefrontHostname("localhost")).toBe("demo.mandys.local");
  });

  it("normalizes stale hosted deployment overrides to the live demo tenant", () => {
    process.env.MANDYS_STOREFRONT_HOSTNAME = "mandy-store-front.netlify.app";
    expect(resolveStorefrontHostname("custom.example")).toBe("demo.mandys.local");
    process.env.MANDYS_STOREFRONT_HOSTNAME = "preview-abc.vercel.app";
    expect(resolveStorefrontHostname("custom.example")).toBe("demo.mandys.local");
  });

  it("preserves a real restaurant custom domain", () => {
    delete process.env.MANDYS_STOREFRONT_HOSTNAME;
    expect(resolveStorefrontHostname("restaurante.example")).toBe("restaurante.example");
  });

  it("allows an explicit custom deployment hostname override", () => {
    process.env.MANDYS_STOREFRONT_HOSTNAME = "demo.restaurant.example";
    expect(resolveStorefrontHostname("preview.vercel.app")).toBe("demo.restaurant.example");
  });

  it("falls back to the production public runtime without environment setup", () => {
    delete process.env.MANDYS_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(getPublicApiUrl()).toBe(
      "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-public",
    );
  });
});
