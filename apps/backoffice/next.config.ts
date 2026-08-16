import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@mandys/auth",
    "@mandys/i18n",
    "@mandys/theme-core",
    "@mandys/theme-minimal",
    "@mandys/ui",
  ],
  env: {
    // Browser requests stay first-party. Next.js proxies them to the secured
    // Mandy's runtime, so no database or service secret is exposed client-side.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "/api/runtime",
  },
  experimental: {
    typedEnv: true,
  },
};

export default withSerwist(nextConfig);
