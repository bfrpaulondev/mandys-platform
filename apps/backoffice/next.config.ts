import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@mandys/i18n",
    "@mandys/theme-core",
    "@mandys/theme-minimal",
    "@mandys/ui",
  ],
  experimental: {
    typedEnv: true,
  },
};

export default withSerwist(nextConfig);
