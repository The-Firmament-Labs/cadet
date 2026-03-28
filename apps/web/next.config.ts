import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@starbridge/core", "@starbridge/sdk"],
};

export default nextConfig;
