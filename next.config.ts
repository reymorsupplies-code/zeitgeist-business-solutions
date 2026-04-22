import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone' removed — causes 404 on Vercel with Next.js 16
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
