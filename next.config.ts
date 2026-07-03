import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Episode uploads include the original PNG and optional thumbnail.
      bodySizeLimit: "25mb",
    },
  },
  images: {
    // Vercel Image Optimization is disabled site-wide. All images are served
    // from Cloudflare R2 (egress-free) and are already sensibly sized, so the
    // /_next/image transformation pipeline only adds cost — and returns 402
    // (Payment Required) once the free transformation quota is exhausted, which
    // blanked detail/hero images. With this off, every <Image> renders as a
    // plain <img> straight from R2; per-component `unoptimized` props and the
    // remotePatterns list below are no longer required (kept for reference).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-9339dc326a024891a297479881e66962.r2.dev",
      },
      {
        // IMAGINE Content Factory assets migrated to Cloudflare R2
        // (production feed/wallpaper outputs). Served via the R2 custom domain.
        protocol: "https",
        hostname: "assets.whatif-ep.xyz",
      },
      {
        // Content Factory feed/wallpaper images served from Supabase Storage.
        protocol: "https",
        hostname: "rgqduwojvylkulhyodqg.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
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
      // IMAGINE's old /upgrade route → consolidated /plans page (M4).
      // Query params (return_to, source) are passed through automatically.
      {
        source: "/upgrade",
        destination: "/plans",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
