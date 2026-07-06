// Single asset-reference module for the consolidated app (M3).
//
// Background (see docs/M3_ASSET_KEY_PLAN.md and
// imagine/docs/ASSET_REFERENCE_REDESIGN.md): the app used to bake absolute
// backend URLs into the database (banners/templates thumbnail columns and the
// JSONB elements[].src). Every time storage moved (Supabase -> R2) those rows
// had to be find-and-rewritten, and any missed field silently 404'd once the
// original file was deleted.
//
// The fix is to store a backend-independent relative object key everywhere and
// build the URL only at render time. This module owns:
//   - the key convention (logical bucket prefix + path)
//   - resolution (key -> URL) with a migration-period passthrough / fallback
//   - deterministic key generators (overwrite-in-place, no random revisions)
//
// Target state: a single R2 bucket served from assets.whatif-ep.xyz, where the
// logical bucket name (`user-images` / `default-images`) is the key prefix.
// During migration, bare keys (no logical prefix) still resolve to where the
// object physically lives today via the `legacyBucket` hint.

import { appendVersion } from "./asset-url";

// Brand type: keeps absolute URLs from being stored as asset keys by mistake.
// It is a plain string at runtime; the brand only exists at the type level.
export type AssetKey = string & { readonly __brand: "AssetKey" };

export type LegacyBucket = "user-images" | "default-images";

const R2_ASSETS_BASE_URL = (
  process.env.NEXT_PUBLIC_IMAGINE_ASSETS_BASE_URL || "https://assets.whatif-ep.xyz"
).replace(/\/+$/, "");

const SUPABASE_BASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");

const LOGICAL_BUCKET_PREFIXES = ["user-images/", "default-images/"];
const SUPABASE_PUBLIC_OBJECT_PATH_SEGMENT = "/storage/v1/object/public/";

// True when the value is already an absolute http(s) URL (legacy full-URL rows
// and external OAuth avatars). Such values pass through resolution untouched.
export function isFullUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

// True for inline sources (data URLs, in-memory blob URLs) that never touch
// storage and must pass through untouched.
export function isInlineData(value: string): boolean {
  return value.startsWith("data:") || value.startsWith("blob:");
}

// True when a stored value is a relative asset key (neither a full URL nor
// inline data), i.e. something this module resolves against a storage backend.
export function isAssetKey(value: string): boolean {
  return Boolean(value) && !isFullUrl(value) && !isInlineData(value);
}

// Assert a raw string as an AssetKey. Use only where the caller guarantees the
// value is a relative key (deterministic generators below already return one).
export function asAssetKey(value: string): AssetKey {
  return value as AssetKey;
}

const encodeKeySegments = (key: string): string =>
  key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const decodeKeySegments = (key: string): string =>
  key
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");

// Append a cache-busting `?v=` param while preserving any URL hash. Shares the
// core query logic with the Gallery resolver's appendVersion (asset-url.ts) so
// the two stay in lockstep; adds hash handling for parity with the previous
// editor-side appendCacheBust.
export function appendCacheBust(url: string, version?: string | null): string {
  if (!version) return url;
  const [base, hash] = url.split("#", 2);
  const versioned = appendVersion(base, version);
  return hash ? `${versioned}#${hash}` : versioned;
}

interface ResolveOptions {
  version?: string | null;
  // Bucket a *bare* key (no logical prefix) belongs to, used only during the
  // migration window to reach the object where it physically lives today.
  legacyBucket?: LegacyBucket;
}

const buildR2AssetUrl = (key: string, version?: string | null): string =>
  appendCacheBust(`${R2_ASSETS_BASE_URL}/${encodeKeySegments(key)}`, version);

const extractKnownAssetKey = (value: string): string | null => {
  try {
    const url = new URL(value);
    const r2Base = new URL(R2_ASSETS_BASE_URL);
    const r2BasePath = r2Base.pathname.replace(/\/+$/, "");
    const supabaseBase = SUPABASE_BASE_URL ? new URL(SUPABASE_BASE_URL) : null;
    const supabaseBasePath = supabaseBase?.pathname.replace(/\/+$/, "") ?? "";

    if (url.origin === r2Base.origin) {
      const path = r2BasePath
        ? url.pathname.startsWith(`${r2BasePath}/`)
          ? url.pathname.slice(r2BasePath.length)
          : url.pathname === r2BasePath
            ? ""
            : url.pathname
        : url.pathname;
      const key = decodeKeySegments(path.replace(/^\/+/, ""));
      return key || null;
    }

    if (
      supabaseBase &&
      url.origin === supabaseBase.origin &&
      url.pathname.startsWith(`${supabaseBasePath}${SUPABASE_PUBLIC_OBJECT_PATH_SEGMENT}`)
    ) {
      const key = decodeKeySegments(
        url.pathname.slice(`${supabaseBasePath}${SUPABASE_PUBLIC_OBJECT_PATH_SEGMENT}`.length)
      );
      return key || null;
    }

    return null;
  } catch {
    return null;
  }
};

// Core resolver: turn a stored value into a renderable URL.
//   - full URL / data: / blob:  -> passthrough (+ optional ?v=)
//   - key with logical prefix    -> R2 custom domain ({BASE}/{key})
//   - bare key + legacyBucket    -> logical-bucket-prefixed R2 URL
//
// `user-images` objects have already been copied into `whatif-assets`, so the
// consolidated app no longer needs to bounce editor/runtime image loads back
// through Supabase public storage. Keeping a single assets origin is the more
// stable target: one cache layer, one CORS surface, one resolver behavior.
export function resolveAsset(
  value: string | null | undefined,
  options: ResolveOptions = {}
): string {
  if (!value) return "";
  const { version, legacyBucket } = options;

  if (isInlineData(value)) {
    return appendCacheBust(value, version);
  }

  if (isFullUrl(value)) {
    const normalizedKey = extractKnownAssetKey(value);
    if (normalizedKey) {
      return buildR2AssetUrl(normalizedKey, version);
    }
    return appendCacheBust(value, version);
  }

  const key = value.replace(/^\/+/, "");
  const hasLogicalPrefix = LOGICAL_BUCKET_PREFIXES.some((prefix) => key.startsWith(prefix));

  if (hasLogicalPrefix) {
    return buildR2AssetUrl(key, version);
  }

  const bucket = legacyBucket ?? "default-images";
  return buildR2AssetUrl(`${bucket}/${key}`, version);
}

// Resolve a canvas element's `src` at load time. Editor state keeps `src` as a
// key; external images (full URLs) and inline data pass through unchanged.
export function resolveElementSrc(
  src: string | null | undefined,
  version?: string | null
): string {
  if (!src) return "";
  return resolveAsset(src, { version, legacyBucket: "user-images" });
}

// --- Deterministic key generators (overwrite-in-place, no random revision) ---

export function buildBannerThumbKey(uid: string, bannerId: string): AssetKey {
  return `user-images/${uid}/banners/${bannerId}/thumb.jpg` as AssetKey;
}

export function buildBannerFullKey(uid: string, bannerId: string): AssetKey {
  return `user-images/${uid}/banners/${bannerId}/full.png` as AssetKey;
}

export function buildUserUploadKey(uid: string, assetId: string, ext: string): AssetKey {
  return `user-images/${uid}/uploads/${assetId}.${ext}` as AssetKey;
}

export function buildTemplateThumbKey(templateId: string): AssetKey {
  return `default-images/templates/${templateId}/thumb.jpg` as AssetKey;
}

export function buildLibraryAssetKey(assetId: string, ext: string): AssetKey {
  return `default-images/library/${assetId}.${ext}` as AssetKey;
}

// Prefix a bare library storage_path with its logical bucket to form a full
// asset key (used when embedding default_images assets into element src).
export function toDefaultImageKey(storagePath: string): AssetKey {
  const clean = storagePath.replace(/^\/+/, "");
  return (clean.startsWith("default-images/") ? clean : `default-images/${clean}`) as AssetKey;
}
