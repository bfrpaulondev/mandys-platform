import type { NextConfig } from "next";

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
    MANDYS_STOREFRONT_HOSTNAME:
      process.env.MANDYS_STOREFRONT_HOSTNAME ?? "demo.mandys.local",
  },
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
