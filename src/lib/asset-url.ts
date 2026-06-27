// Single provider-aware public URL resolver for stored gallery assets.
//
// Background: image URL construction used to be scattered across images.ts,
// work-images.ts, wallpaper.ts and club/catalog.ts. When IMAGINE storage moved
// to Cloudflare R2, one of those sites missed the new provider and served a
// deleted Supabase URL. Centralizing resolution here makes "add a provider,
// miss a call site" structurally impossible — every renderer goes through
// resolveAssetUrl (or the full-URL passthrough below).
//
// Three storage backends coexist today:
//   - 'supabase'  : Supabase Storage public endpoint
//                   {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
//   - 'r2-legacy' : legacy public R2 bucket (pub-….r2.dev) reached via
//                   NEXT_PUBLIC_R2_BASE_URL; object key is the bare storage key
//                   ({base}/{key}, no logical bucket prefix). Used by existing
//                   gallery episodes, works/variants and club assets.
//   - 'r2-assets' : new R2 custom domain (assets.whatif-ep.xyz) for IMAGINE
//                   production outputs; key layout is {bucket}/{path}.
//
// Stored values are a mix of relative keys and full URLs (legacy rows hold
// absolute Supabase/R2 URLs). Callers that may receive either use
// isFullUrl / resolveStoredAssetUrl so a full URL passes through untouched.

export type StorageProvider = "supabase" | "r2-legacy" | "r2-assets";

const R2_LEGACY_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

// IMAGINE Content Factory assets migrated to R2 are served from this custom
// domain. Default mirrors the previous inline default in wallpaper.ts.
const R2_ASSETS_BASE_URL =
  process.env.NEXT_PUBLIC_IMAGINE_ASSETS_BASE_URL || "https://assets.whatif-ep.xyz";

const SUPABASE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// True when a stored value is already an absolute http(s) URL and should be
// served as-is (legacy full-URL rows). Mirrors the prior /^https?:\/\//i test.
export function isFullUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

// Append a cache-busting `?v=` param. `useUrlApi` reproduces work-images.ts's
// previous behavior (parse via URL, set searchParams, fall back to manual
// concat on failure). The simpler form (images.ts) manually concatenates and
// always encodes. Both are preserved so no rendered URL changes.
export function appendVersion(
  url: string,
  version?: string | null,
  useUrlApi = false
): string {
  if (!version) return url;

  if (useUrlApi) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("v", version);
      return parsed.toString();
    } catch {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}v=${encodeURIComponent(version)}`;
    }
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

// Whether the configured base for a provider is available (or the value is a
// full URL needing no base). Lets callers preserve their "skip when no base"
// behavior without re-reading env vars.
export function canResolve(provider: StorageProvider, value: string): boolean {
  if (isFullUrl(value)) return true;
  switch (provider) {
    case "r2-legacy":
      return Boolean(R2_LEGACY_BASE_URL);
    case "r2-assets":
      return Boolean(R2_ASSETS_BASE_URL);
    case "supabase":
      return Boolean(SUPABASE_BASE_URL);
  }
}

interface ResolveOptions {
  version?: string | null;
  // Use the URL-API based version appender (work-images.ts compatibility).
  useUrlApiForVersion?: boolean;
}

// Core resolver. `key` is either a bare storage key (joined to the provider
// base) or a full URL (passed through). For 'r2-assets' the caller passes the
// `{bucket}/{path}` key already composed via r2AssetsKey, matching the prior
// wallpaper.ts layout.
export function resolveAssetUrl(
  provider: StorageProvider,
  key: string,
  options: ResolveOptions = {}
): string {
  const { version, useUrlApiForVersion = false } = options;

  if (isFullUrl(key)) {
    return appendVersion(key, version, useUrlApiForVersion);
  }

  const cleanKey = key.replace(/^\/+/, "");
  let base: string;
  switch (provider) {
    case "r2-legacy":
      base = `${R2_LEGACY_BASE_URL}/${cleanKey}`;
      break;
    case "r2-assets":
      base = `${R2_ASSETS_BASE_URL}/${cleanKey}`;
      break;
    case "supabase":
      base = `${SUPABASE_BASE_URL}/storage/v1/object/public/${cleanKey}`;
      break;
  }

  return appendVersion(base, version, useUrlApiForVersion);
}

// Compose the R2-assets object key from a logical bucket + path, mirroring the
// legacy Supabase layout: `{bucket}/{path}`.
export function r2AssetsKey(bucket: string, path: string): string {
  return `${bucket}/${path.replace(/^\/+/, "")}`;
}
