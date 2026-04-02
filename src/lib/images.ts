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

export function getImageUrl(
  episodeNumber: string,
  type: "original" | "thumbnail" = "thumbnail"
): string {
  return type === "original"
    ? getOriginalUrl(episodeNumber)
    : getThumbnailUrl(episodeNumber);
}
