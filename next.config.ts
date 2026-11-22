import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "@modelcontextprotocol/sdk"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
