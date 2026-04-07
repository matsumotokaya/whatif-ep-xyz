import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Episode uploads include the original PNG and optional thumbnail.
      bodySizeLimit: "25mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-9339dc326a024891a297479881e66962.r2.dev",
      },
      // Add custom domain when configured
      // { protocol: "https", hostname: "assets.whatif-ep.com" },
    ],
    formats: ["image/webp", "image/avif"],
  },
};

export default nextConfig;
