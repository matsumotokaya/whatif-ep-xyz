import { describe, expect, it } from "vitest";
import { getGalleryListThumbnailUrl } from "./work-images";

describe("getGalleryListThumbnailUrl", () => {
  it("builds the versioned R2 assets URL used by the backfill", () => {
    expect(getGalleryListThumbnailUrl("episode", "0001")).toBe(
      "https://assets.whatif-ep.xyz/gallery-thumbs/v1/episode/0001.webp"
    );
  });

  it("encodes path segments", () => {
    expect(getGalleryListThumbnailUrl("special series", "A/B")).toBe(
      "https://assets.whatif-ep.xyz/gallery-thumbs/v1/special%20series/A%2FB.webp"
    );
  });
});
