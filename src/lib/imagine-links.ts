// Normalizes legacy IMAGINE deep links into internal routes.
//
// Background: IMAGINE (formerly hosted on the app.whatif-ep.xyz subdomain)
// was consolidated into this Next.js app, with the editor now living at
// /edit. Existing DB rows (work_offers.target_url) may still hold the old
// absolute form (e.g. "https://app.whatif-ep.xyz/banner?template=<id>").
// This helper rewrites those into same-origin routes at render time so pages
// don't redirect out to a frozen production subdomain — which also makes
// local/dev testing possible. It does not touch the database.
const IMAGINE_HOST = "app.whatif-ep.xyz";

export function normalizeImagineDeepLink(url: string): string {
  // Already relative — nothing to normalize.
  if (url.startsWith("/")) {
    return url;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not a parseable absolute URL; return unchanged rather than crash.
    return url;
  }

  if (parsed.hostname !== IMAGINE_HOST) {
    return url;
  }

  const { pathname, search, hash } = parsed;

  // /banner?template=<id> -> /edit?template=<id> (all query params kept)
  if (pathname === "/banner") {
    return `/edit${search}${hash}`;
  }

  // /banner/<id> -> /edit/<id>
  if (pathname.startsWith("/banner/")) {
    return `/edit${pathname.slice("/banner".length)}${search}${hash}`;
  }

  // /banners -> /mydesign and /banners/<sizeKey> -> /mydesign/<sizeKey>
  if (pathname === "/banners" || pathname.startsWith("/banners/")) {
    return `/mydesign${pathname.slice("/banners".length)}${search}${hash}`;
  }

  // /upgrade -> /plans (the /upgrade route itself now redirects to /plans,
  // but normalize directly here to skip the extra hop). Query is preserved.
  if (pathname === "/upgrade" || pathname.startsWith("/upgrade/")) {
    return `/plans${pathname.slice("/upgrade".length)}${search}${hash}`;
  }

  // Any other path on the IMAGINE host (including /plans itself) -> the same
  // path relativized onto this origin.
  return `${pathname}${search}${hash}`;
}
