import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["grammy"],
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

// Force dev server restart to reload middleware
export default nextConfig;

