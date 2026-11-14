import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/mcp/:path*",
        destination: `${backendUrl}/mcp/:path*`,
      },
      {
        source: "/oauth2/authorize",
        destination: "/oauth/authorize",
      },
      {
        source: "/oauth2/logout",
        destination: "/oauth/logout",
      },
      {
        source: "/oauth2/token",
        destination: `${backendUrl}/api/v1/oauth/token`,
      },
      {
        source: "/oauth2/userinfo",
        destination: `${backendUrl}/api/v1/oauth/userinfo`,
      },
    ];
  },
};

export default nextConfig;

