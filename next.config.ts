import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
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
        source: "/api/library/:path*",
        destination: `${BACKEND_URL}/library/:path*`,
      },
    ];
  },
};

export default nextConfig;
