// Compatibility shim (M3). The asset-reference logic now lives in the single
// app-wide module src/lib/asset.ts. This file only re-exports from there so the
// existing editor imports keep resolving; it is slated for removal in Phase 4.
export {
  appendCacheBust,
  isFullUrl,
  isInlineData,
  isAssetKey,
  asAssetKey,
  resolveAsset,
  resolveElementSrc,
  buildBannerThumbKey,
  buildBannerFullKey,
  buildUserUploadKey,
  buildTemplateThumbKey,
  buildLibraryAssetKey,
  toDefaultImageKey,
  type AssetKey,
  type LegacyBucket,
} from "@/lib/asset";

// Retained for callers still recording default_images.storage_provider until
// that column is dropped (Stage D). New writes are all R2-backed.
export type StorageProvider = "supabase" | "r2";
