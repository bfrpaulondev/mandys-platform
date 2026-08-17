import type { NextConfig } from "next";

const storefrontHostname = process.env.MANDYS_STOREFRONT_HOSTNAME?.trim();

if (process.env.NODE_ENV === "production" && !storefrontHostname) {
  throw new Error(
    "MANDYS_STOREFRONT_HOSTNAME must be configured for production Storefront builds.",
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@mandys/i18n",
    "@mandys/theme-core",
    "@mandys/theme-minimal",
    "@mandys/ui",
  ],
  env: {
    MANDYS_API_URL:
      process.env.MANDYS_API_URL ??
      "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-public",
    MANDYS_STOREFRONT_HOSTNAME: storefrontHostname ?? "demo.mandys.local",
  },
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
