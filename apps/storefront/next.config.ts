import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
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

export default nextConfig;
