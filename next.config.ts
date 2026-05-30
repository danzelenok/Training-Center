import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["grammy"],
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
