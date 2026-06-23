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
    // Single format keeps each (image, width) to one optimized output instead of
    // doubling across webp + avif. Trades a tiny avif size win for ~half the
    // Image Optimization transformations.
    formats: ["image/webp"],
    // Curated width ladder (default is 8 device + 8 image sizes). Fewer rungs =
    // fewer distinct transformations per source image, while still covering the
    // real layouts: small covers, detail hero (1x/2x), and retina.
    deviceSizes: [640, 1080, 1920, 3840],
    imageSizes: [128, 256, 384],
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
