import type { Work, WorkVariant } from "./types";
import { resolveAssetUrl, canResolve, isFullUrl } from "./asset-url";

// Works / variants resolve against the legacy public R2 bucket, but stored
// values may be either bare keys or full URLs (legacy rows). resolveAssetUrl
// passes full URLs through and joins bare keys onto NEXT_PUBLIC_R2_BASE_URL.
// useUrlApiForVersion preserves the prior URL-API based `?v=` appending.
function buildAssetUrl(storageKey: string, version?: string): string {
  return resolveAssetUrl("r2-legacy", storageKey, {
    version,
    useUrlApiForVersion: true,
  });
}

function canResolveStorageKey(storageKey: string): boolean {
  return isFullUrl(storageKey) || canResolve("r2-legacy", storageKey);
}

export function getVariantOriginalUrl(
  variant: Pick<WorkVariant, "originalStorageKey" | "updatedAt">
): string {
  if (!variant.originalStorageKey) return "";
  return buildAssetUrl(variant.originalStorageKey, variant.updatedAt);
}

export function getVariantThumbnailCandidates(
  variant: Pick<WorkVariant, "thumbnailStorageKey" | "originalStorageKey" | "updatedAt">
): string[] {
  const candidates = [variant.thumbnailStorageKey, variant.originalStorageKey].filter(
    (value): value is string =>
      typeof value === "string" && value.length > 0 && canResolveStorageKey(value)
  );

  return [...new Set(candidates)].map((storageKey) =>
    buildAssetUrl(storageKey, variant.updatedAt)
  );
}

export function getVariantDisplayImageCandidates(
  variant: Pick<WorkVariant, "feedImageUrl" | "originalStorageKey" | "updatedAt">
): string[] {
  const candidates = [
    variant.feedImageUrl ?? null,
    variant.originalStorageKey ? buildAssetUrl(variant.originalStorageKey, variant.updatedAt) : null,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

export function getVariantDetailImageCandidates(
  variant: Pick<
    WorkVariant,
    | "feedThumbUrl"
    | "feedImageUrl"
    | "thumbnailStorageKey"
    | "originalStorageKey"
    | "updatedAt"
  >
): string[] {
  const candidates = [
    variant.feedThumbUrl ?? null,
    variant.feedImageUrl ?? null,
    ...getVariantThumbnailCandidates(variant),
    variant.originalStorageKey ? buildAssetUrl(variant.originalStorageKey, variant.updatedAt) : null,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

export function getWorkPrimaryImageCandidates(work: Work): string[] {
  if (!work.primaryVariant) return [];
  return getVariantThumbnailCandidates(work.primaryVariant);
}
