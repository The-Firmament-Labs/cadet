import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@starbridge/core", "@starbridge/sdk"],
  serverExternalPackages: [
    "@chat-adapter/discord",
    "discord.js",
    "@discordjs/ws",
    "zlib-sync",
  ],
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default withWorkflow(nextConfig);
