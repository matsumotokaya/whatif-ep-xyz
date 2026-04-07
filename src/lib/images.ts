import type { Episode } from "./types";

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

type EpisodeImageRef = Pick<
  Episode,
  "number" | "originalStorageKey" | "thumbnailStorageKey" | "updatedAt"
>;

function buildAssetUrl(storageKey: string, version?: string): string {
  const base = `${R2_BASE_URL}/${storageKey.replace(/^\/+/, "")}`;
  if (!version) return base;
  return `${base}?v=${encodeURIComponent(version)}`;
}

function resolveVersion(episode: EpisodeImageRef | string): string | undefined {
  if (typeof episode === "string") return undefined;
  return episode.updatedAt;
}

function resolveOriginalStorageKey(episode: EpisodeImageRef | string): string {
  if (typeof episode === "string") {
    return `originals/${episode}.png`;
  }
  return episode.originalStorageKey || `originals/${episode.number}.png`;
}

export function getOriginalUrl(episode: EpisodeImageRef | string): string {
  return buildAssetUrl(resolveOriginalStorageKey(episode), resolveVersion(episode));
}

export function getThumbnailUrl(
  episode: EpisodeImageRef | string,
  ext: "jpg" | "webp" = "jpg"
): string {
  if (typeof episode !== "string" && episode.thumbnailStorageKey && ext === "jpg") {
    return buildAssetUrl(episode.thumbnailStorageKey, resolveVersion(episode));
  }

  const episodeNumber = typeof episode === "string" ? episode : episode.number;
  return buildAssetUrl(`thumbnails/${episodeNumber}.${ext}`, resolveVersion(episode));
}

// Returns ordered list of URLs to try for a thumbnail.
// Caller should fall through on error: jpg → png → original png
export function getThumbnailCandidates(episode: EpisodeImageRef | string): string[] {
  if (!R2_BASE_URL) return [];

  const episodeNumber = typeof episode === "string" ? episode : episode.number;
  const thumbnailStorageKey =
    typeof episode === "string" ? null : episode.thumbnailStorageKey;
  const originalStorageKey = resolveOriginalStorageKey(episode);
  const version = resolveVersion(episode);

  if (typeof episode !== "string" && !thumbnailStorageKey) {
    return [buildAssetUrl(originalStorageKey, version)];
  }

  const candidates = [
    thumbnailStorageKey,
    `thumbnails/${episodeNumber}.jpg`,
    `thumbnails/${episodeNumber}.png`,
    originalStorageKey,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)].map((key) => buildAssetUrl(key, version));
}
