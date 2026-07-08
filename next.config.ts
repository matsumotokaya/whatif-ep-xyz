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
      // M5 host-level cutover: once app.whatif-ep.xyz still points at this
      // deployment, redirect every legacy request to the gallery top.
      // The product decision is to prioritize a fast retirement of the legacy
      // IMAGINE app over deep-link preservation because usage is negligible.
      //
      // Use an explicit 301 because the cutover requirement is permanent host
      // canonicalization for legacy GET deep links. Next's `permanent: true`
      // emits 308 by default, which is not what ops wants here.
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "app.whatif-ep.xyz",
          },
        ],
        destination: "https://whatif-ep.xyz",
        statusCode: 301,
        basePath: false,
      },
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
      {
        source: "/upgrade/:path*",
        destination: "/plans/:path*",
        permanent: false,
      },
      // Legacy IMAGINE deep links → consolidated editor routes. These are
      // required before app.whatif-ep.xyz can be 301'd to this domain.
      // Query params (template, return_to, source, etc.) are passed through.
      {
        source: "/banner",
        destination: "/edit",
        permanent: false,
      },
      {
        source: "/banner/:id",
        destination: "/edit/:id",
        permanent: false,
      },
      {
        source: "/banners",
        destination: "/mydesign",
        permanent: false,
      },
      {
        source: "/banners/:sizeKey",
        destination: "/mydesign/:sizeKey",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
