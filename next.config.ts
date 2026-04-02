import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.workers.dev",
      },
      // Add R2 custom domain when configured
      // { protocol: "https", hostname: "assets.whatif-ep.com" },
    ],
    formats: ["image/webp", "image/avif"],
  },
};

export default nextConfig;
