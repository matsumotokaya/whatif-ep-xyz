import type { Work, WorkVariant } from "./types";

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

function appendVersionParam(url: string, version?: string): string {
  if (!version) return url;

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("v", version);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(version)}`;
  }
}

function buildAssetUrl(storageKey: string, version?: string): string {
  if (/^https?:\/\//i.test(storageKey)) {
    return appendVersionParam(storageKey, version);
  }
  const base = `${R2_BASE_URL}/${storageKey.replace(/^\/+/, "")}`;
  return appendVersionParam(base, version);
}

function canResolveStorageKey(storageKey: string): boolean {
  return /^https?:\/\//i.test(storageKey) || Boolean(R2_BASE_URL);
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

export function getWorkPrimaryImageCandidates(work: Work): string[] {
  if (!work.primaryVariant) return [];
  return getVariantThumbnailCandidates(work.primaryVariant);
}
