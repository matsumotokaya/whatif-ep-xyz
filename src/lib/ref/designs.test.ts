import { beforeEach, describe, expect, it } from "vitest";
import {
  isUuid,
  mapRowToRefDesign,
  stripImageExtension,
  type RefDesignRow,
} from "./designs";

const UPDATED_AT = "2026-09-01T12:00:00.000Z";
const ID = "11111111-2222-4333-8444-555555555555";

function row(overrides: Partial<RefDesignRow> = {}): RefDesignRow {
  return {
    id: ID,
    name: "Teaser A",
    template: { width: 1080, height: 1920 },
    thumbnail_key: `user-images/uid/banners/${ID}/thumb/rev1.jpg`,
    fullres_key: `user-images/uid/banners/${ID}/full/rev1.jpg`,
    thumbnail_url: null,
    fullres_url: null,
    preview_status: "ready",
    document_revision: 7,
    preview_revision: 7,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

describe("stripImageExtension", () => {
  it("removes a cosmetic image suffix, case-insensitively", () => {
    expect(stripImageExtension(`${ID}.jpg`)).toBe(ID);
    expect(stripImageExtension(`${ID}.JPEG`)).toBe(ID);
    expect(stripImageExtension(`${ID}.Png`)).toBe(ID);
  });

  it("leaves a bare id and other suffixes untouched", () => {
    expect(stripImageExtension(ID)).toBe(ID);
    expect(stripImageExtension(`${ID}.webp`)).toBe(`${ID}.webp`);
  });
});

describe("isUuid", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid(ID.toUpperCase())).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    // No SQL-ish or path-ish input slips through to an `in` filter.
    expect(isUuid(`${ID}' or '1`)).toBe(false);
  });
});

describe("mapRowToRefDesign", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz";
  });

  it("prefers the full-res render and resolves it against the assets origin", () => {
    const design = mapRowToRefDesign(row());

    expect(design.urlKind).toBe("full");
    expect(design.url).toBe(
      `https://assets.whatif-ep.xyz/user-images/uid/banners/${ID}/full/rev1.jpg?v=${encodeURIComponent(UPDATED_AT)}`
    );
    expect(design.thumbnailUrl).toContain("/thumb/rev1.jpg");
    expect(design.width).toBe(1080);
    expect(design.height).toBe(1920);
    expect(design.previewStatus).toBe("ready");
    expect(design.stale).toBe(false);
  });

  it("builds stable ref and edit URLs from the site origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz/";
    const design = mapRowToRefDesign(row());

    expect(design.refUrl).toBe(`https://whatif-ep.xyz/ref/${ID}`);
    expect(design.editUrl).toBe(`https://whatif-ep.xyz/edit/${ID}`);
  });

  it("falls back to the thumbnail when there is no full-res render", () => {
    const design = mapRowToRefDesign(row({ fullres_key: null }));

    expect(design.urlKind).toBe("thumb");
    expect(design.url).toContain("/thumb/rev1.jpg");
    expect(design.url).toBe(design.thumbnailUrl);
  });

  it("reports no image when neither render exists", () => {
    const design = mapRowToRefDesign(
      row({ fullres_key: null, thumbnail_key: null })
    );

    expect(design.url).toBeNull();
    expect(design.urlKind).toBeNull();
    expect(design.thumbnailUrl).toBeNull();
    // Nothing rendered means nothing to be stale about; `url: null` is the signal.
    expect(design.stale).toBe(false);
  });

  it("resolves legacy absolute URL columns through the same assets origin", () => {
    const design = mapRowToRefDesign(
      row({
        fullres_key: null,
        thumbnail_key: null,
        fullres_url: `https://assets.whatif-ep.xyz/user-images/uid/banners/${ID}/full/legacy.jpg`,
      })
    );

    expect(design.urlKind).toBe("full");
    expect(design.url).toContain(
      `https://assets.whatif-ep.xyz/user-images/uid/banners/${ID}/full/legacy.jpg?v=`
    );
  });

  it("marks a design stale when the render is behind the document", () => {
    expect(mapRowToRefDesign(row({ preview_revision: 6 })).stale).toBe(true);
    expect(mapRowToRefDesign(row({ preview_status: "pending" })).stale).toBe(true);
    expect(mapRowToRefDesign(row({ preview_status: "failed" })).stale).toBe(true);
    expect(mapRowToRefDesign(row({ preview_status: null })).stale).toBe(true);
    // A document revision with no matching preview revision is a real mismatch.
    expect(mapRowToRefDesign(row({ preview_revision: null })).stale).toBe(true);
  });

  it("does not flag pre-revision rows whose preview is otherwise ready", () => {
    // Rows saved before revision tracking have neither number; equal-and-absent
    // plus preview_status 'ready' is current, not stale.
    const design = mapRowToRefDesign(
      row({ document_revision: null, preview_revision: null })
    );

    expect(design.stale).toBe(false);
  });

  it("treats bigint revisions returned as strings as equal to their numbers", () => {
    const design = mapRowToRefDesign(
      row({ document_revision: "7", preview_revision: 7 })
    );

    expect(design.stale).toBe(false);
  });

  it("normalizes missing name, template dimensions and unknown status", () => {
    const design = mapRowToRefDesign(
      row({ name: null, template: null, preview_status: "weird" })
    );

    expect(design.name).toBe("");
    expect(design.width).toBeNull();
    expect(design.height).toBeNull();
    expect(design.previewStatus).toBeNull();
  });
});
