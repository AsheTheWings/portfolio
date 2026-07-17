import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@portfolio/api-client',
    '@portfolio/auth',
    '@portfolio/chess',
    '@portfolio/timeline',
    '@portfolio/ui',
  ],
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/agent/:path*",
        destination: `${BACKEND_URL}/agent/:path*`,
      },
      {
        source: "/api/auth/ws-ticket",
        destination: `${BACKEND_URL}/auth/ws-ticket`,
      },
      {
        source: "/api/chess/:path*",
        destination: `${BACKEND_URL}/chess/:path*`,
      },
      {
        source: "/api/n8n/:path*",
        destination: `${BACKEND_URL}/n8n/:path*`,
      },
    ];
  },
};

export default nextConfig;
