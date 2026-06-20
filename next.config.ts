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
      {
        // Content Factory feed/wallpaper images served from Supabase Storage.
        protocol: "https",
        hostname: "rgqduwojvylkulhyodqg.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Add custom domain when configured
      // { protocol: "https", hostname: "assets.whatif-ep.com" },
    ],
    formats: ["image/webp", "image/avif"],
  },
  async redirects() {
    return [
      // Legacy gallery index → new works route.
      {
        source: "/episodes",
        destination: "/works/episode",
        permanent: true,
      },
      // Legacy episode detail → new works detail.
      // The `(\\d{1,})` constraint matches numeric codes ONLY, so admin routes
      // /episodes/new and /episodes/:number/edit are never captured here.
      {
        source: "/episodes/:number(\\d{1,})",
        destination: "/works/episode/:number",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
