const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

export function getOriginalUrl(episodeNumber: string): string {
  return `${R2_BASE_URL}/originals/${episodeNumber}.png`;
}

export function getThumbnailUrl(
  episodeNumber: string,
  ext: "jpg" | "webp" = "jpg"
): string {
  return `${R2_BASE_URL}/thumbnails/${episodeNumber}.${ext}`;
}

// Returns ordered list of URLs to try for a thumbnail.
// Caller should fall through on error: jpg → png → original png
export function getThumbnailCandidates(episodeNumber: string): string[] {
  if (!R2_BASE_URL) return [];
  return [
    `${R2_BASE_URL}/thumbnails/${episodeNumber}.jpg`,
    `${R2_BASE_URL}/thumbnails/${episodeNumber}.png`,
    `${R2_BASE_URL}/originals/${episodeNumber}.png`,
  ];
}
