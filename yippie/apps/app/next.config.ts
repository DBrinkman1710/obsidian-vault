import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Railway (Docker) deployments
  output: "standalone",

  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "",
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL ?? "",
  },

  reactStrictMode: true,
};

export default nextConfig;
