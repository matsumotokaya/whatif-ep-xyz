import type { Work, WorkVariant } from "./types";

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

function buildAssetUrl(storageKey: string, version?: string): string {
  const base = `${R2_BASE_URL}/${storageKey.replace(/^\/+/, "")}`;
  if (!version) return base;
  return `${base}?v=${encodeURIComponent(version)}`;
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
  if (!R2_BASE_URL) return [];

  const candidates = [variant.thumbnailStorageKey, variant.originalStorageKey].filter(
    (value): value is string => Boolean(value)
  );

  return [...new Set(candidates)].map((storageKey) =>
    buildAssetUrl(storageKey, variant.updatedAt)
  );
}

export function getWorkPrimaryImageCandidates(work: Work): string[] {
  if (!work.primaryVariant) return [];
  return getVariantThumbnailCandidates(work.primaryVariant);
}
