import { beforeEach, describe, expect, it } from "vitest";
import {
  mapRowToRefAsset,
  orderAssetsByRequestedIds,
  projectRefAsset,
  REF_ASSET_FIELDS,
  REF_ASSET_LIST_FIELDS,
  resolveRefAssetFields,
  type RefAssetRow,
} from "./assets";

const CREATED_AT = "2026-08-06T15:01:50.375Z";
const ID = "00ed8abe-1cc4-4077-a616-f11567c89a71";
const STORAGE_PATH = "official/episode/0313-1/1786028507255-houdofubrj.png";
const THUMBNAIL_PATH =
  "thumbnails/official/episode/0313-1/1786028507255-houdofubrj.jpg";

// Shaped after a real public.default_images row.
function row(overrides: Partial<RefAssetRow> = {}): RefAssetRow {
  return {
    id: ID,
    name: "0313_x4_edit_layered_ch_001.png",
    storage_path: STORAGE_PATH,
    thumbnail_path: THUMBNAIL_PATH,
    width: 1200,
    height: 2000,
    file_size: 1456217,
    tags: ["Character"],
    asset_role: "character_cutout",
    work_series_slug: "episode",
    work_number: 313,
    variant_number: 1,
    created_at: CREATED_AT,
    ...overrides,
  };
}

describe("mapRowToRefAsset", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz";
  });

  it("resolves both images against the assets origin under the library bucket", () => {
    // Library rows store a bare key, so the default-images prefix has to be
    // supplied at resolution time — the same way /api/lab/assets does it.
    const asset = mapRowToRefAsset(row());

    expect(asset.url).toBe(
      `https://assets.whatif-ep.xyz/default-images/${STORAGE_PATH}`
    );
    expect(asset.thumbnailUrl).toBe(
      `https://assets.whatif-ep.xyz/default-images/${THUMBNAIL_PATH}`
    );
    // Immutable objects: no cache-busting version is appended.
    expect(asset.url).not.toContain("?v=");
  });

  it("reports the recorded dimensions as the exact size of the image at `url`", () => {
    const asset = mapRowToRefAsset(row());

    expect(asset.width).toBe(1200);
    expect(asset.height).toBe(2000);
    expect(asset.aspect).toBe("3:5");
  });

  it("builds a stable ref URL under the asset namespace", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz/";
    const asset = mapRowToRefAsset(row());

    // /ref/asset/{id}, never /ref/{id} — that one belongs to designs.
    expect(asset.refUrl).toBe(`https://whatif-ep.xyz/ref/asset/${ID}`);
  });

  it("carries the library's own metadata through unchanged", () => {
    const asset = mapRowToRefAsset(row());

    expect(asset.id).toBe(ID);
    expect(asset.name).toBe("0313_x4_edit_layered_ch_001.png");
    expect(asset.role).toBe("character_cutout");
    expect(asset.tags).toEqual(["Character"]);
    expect(asset.workNumber).toBe(313);
    expect(asset.seriesSlug).toBe("episode");
    expect(asset.variantNumber).toBe(1);
    expect(asset.fileSize).toBe(1456217);
    expect(asset.createdAt).toBe(CREATED_AT);
  });

  it("offers the thumbnail only under its own name", () => {
    // The design side's expensive bug: `url` must never fall back to a small
    // preview while width/height still advertise the full size.
    const asset = mapRowToRefAsset(row({ storage_path: null }));

    expect(asset.url).toBeNull();
    expect(asset.width).toBeNull();
    expect(asset.height).toBeNull();
    expect(asset.thumbnailUrl).toBe(
      `https://assets.whatif-ep.xyz/default-images/${THUMBNAIL_PATH}`
    );
  });

  it("keeps the aspect ratio even with no image to point at", () => {
    // The ratio is a property of the asset, not of the URL.
    const asset = mapRowToRefAsset(row({ storage_path: null }));

    expect(asset.aspect).toBe("3:5");
  });

  it("reports no thumbnail when the row has none", () => {
    const asset = mapRowToRefAsset(row({ thumbnail_path: null }));

    expect(asset.thumbnailUrl).toBeNull();
    expect(asset.url).not.toBeNull();
  });

  it("normalizes missing name, role, tags and numbers", () => {
    const asset = mapRowToRefAsset(
      row({
        name: null,
        asset_role: null,
        tags: null,
        width: null,
        height: null,
        file_size: null,
        work_series_slug: null,
        work_number: null,
        variant_number: null,
      })
    );

    expect(asset.name).toBe("");
    expect(asset.role).toBe("");
    expect(asset.tags).toEqual([]);
    expect(asset.width).toBeNull();
    expect(asset.height).toBeNull();
    expect(asset.aspect).toBeNull();
    expect(asset.fileSize).toBeNull();
    expect(asset.seriesSlug).toBeNull();
    expect(asset.workNumber).toBeNull();
    expect(asset.variantNumber).toBeNull();
  });
});

describe("field projection", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz";
  });

  it("lists every RefAsset key exactly once", () => {
    // `fields=all` projects REF_ASSET_FIELDS, so a field missing from that
    // array would silently be unreachable.
    const asset = mapRowToRefAsset(row());

    expect([...REF_ASSET_FIELDS].sort()).toEqual(Object.keys(asset).sort());
  });

  it("keeps the list shape a subsequence of the canonical order", () => {
    // Otherwise a record's keys would be ordered differently depending on
    // whether `fields` was passed.
    expect(
      REF_ASSET_FIELDS.filter((field) =>
        (REF_ASSET_LIST_FIELDS as readonly string[]).includes(field)
      )
    ).toEqual([...REF_ASSET_LIST_FIELDS]);
  });

  it("defaults to the compact list shape", () => {
    expect(resolveRefAssetFields(undefined)).toEqual(REF_ASSET_LIST_FIELDS);
    expect(resolveRefAssetFields(null)).toEqual(REF_ASSET_LIST_FIELDS);
    expect(resolveRefAssetFields("  ")).toEqual(REF_ASSET_LIST_FIELDS);

    const projected = projectRefAsset(
      mapRowToRefAsset(row()),
      resolveRefAssetFields(undefined)
    );

    expect(Object.keys(projected)).toEqual([...REF_ASSET_LIST_FIELDS]);
    expect(projected).not.toHaveProperty("refUrl");
    expect(projected).not.toHaveProperty("thumbnailUrl");
    expect(projected).not.toHaveProperty("fileSize");
    expect(projected).not.toHaveProperty("createdAt");
    expect(projected).not.toHaveProperty("seriesSlug");
  });

  it("returns exactly the named fields, not the compact shape plus them", () => {
    expect(resolveRefAssetFields("id,name,url")).toEqual([
      "id",
      "name",
      "url",
    ]);

    const projected = projectRefAsset(
      mapRowToRefAsset(row()),
      resolveRefAssetFields("refUrl,thumbnailUrl")
    );

    expect(Object.keys(projected)).toEqual(["id", "thumbnailUrl", "refUrl"]);
    expect(projected.refUrl).toBe(`https://whatif-ep.xyz/ref/asset/${ID}`);
    expect(projected.thumbnailUrl).toContain("/thumbnails/");
    expect(projected).not.toHaveProperty("fileSize");
    // Dropped, even though the compact record carries them.
    expect(projected).not.toHaveProperty("url");
    expect(projected).not.toHaveProperty("tags");
  });

  it("keeps `id` even when the caller does not name it", () => {
    expect(resolveRefAssetFields("name")).toEqual(["id", "name"]);
    expect(
      Object.keys(
        projectRefAsset(mapRowToRefAsset(row()), resolveRefAssetFields("url"))
      )
    ).toEqual(["id", "url"]);
  });

  it("reads an array of names exactly like the comma-separated string", () => {
    expect(resolveRefAssetFields(["id", "name"])).toEqual(
      resolveRefAssetFields("id,name")
    );
    expect(resolveRefAssetFields(["id,name", " role "])).toEqual([
      "id",
      "name",
      "role",
    ]);
    expect(resolveRefAssetFields([])).toEqual(REF_ASSET_LIST_FIELDS);
    expect(resolveRefAssetFields(["all"])).toEqual(REF_ASSET_FIELDS);
  });

  it("keys projected records in the canonical field order", () => {
    const projected = projectRefAsset(
      mapRowToRefAsset(row()),
      resolveRefAssetFields("createdAt,seriesSlug")
    );

    // Canonical order, not the caller's argument order.
    expect(Object.keys(projected).indexOf("seriesSlug")).toBeLessThan(
      Object.keys(projected).indexOf("createdAt")
    );
  });

  it("returns the full record for `all`, case-insensitively", () => {
    expect(resolveRefAssetFields("all")).toEqual(REF_ASSET_FIELDS);
    expect(resolveRefAssetFields("ALL")).toEqual(REF_ASSET_FIELDS);
    expect(resolveRefAssetFields("refUrl,all")).toEqual(REF_ASSET_FIELDS);

    const projected = projectRefAsset(
      mapRowToRefAsset(row()),
      resolveRefAssetFields("all")
    );

    expect(Object.keys(projected)).toEqual([...REF_ASSET_FIELDS]);
  });

  it("ignores unknown field names instead of failing the request", () => {
    expect(resolveRefAssetFields("nope, ,refUrl,also-not-a-field")).toEqual(
      resolveRefAssetFields("refUrl")
    );
    // Nothing recognisable was asked for, so the honest answer is ids alone.
    expect(resolveRefAssetFields("totally-made-up")).toEqual(["id"]);
  });

  it("matches requested field names case-insensitively", () => {
    expect(resolveRefAssetFields("REFURL")).toContain("refUrl");
  });
});

// Ids that differ only in their last block.
const idAt = (n: number) =>
  `11111111-2222-4333-8444-${String(n).padStart(12, "0")}`;

// A uuid with hex letters, so upper-casing it actually changes the string.
const HEX_ID = "aabbccdd-1122-4333-8444-abcdefabcdef";

const assetWithId = (id: string) => mapRowToRefAsset(row({ id }));

describe("orderAssetsByRequestedIds", () => {
  it("returns the assets in the caller's order, not the query's", () => {
    const requested = [idAt(3), idAt(1), idAt(2)];
    const fetched = [idAt(1), idAt(2), idAt(3)].map(assetWithId);

    const { assets, missing } = orderAssetsByRequestedIds(fetched, requested);

    expect(assets.map((a) => a.id)).toEqual(requested);
    expect(missing).toEqual([]);
  });

  it("reports unresolved ids in `missing`, in the requested order", () => {
    const { assets, missing } = orderAssetsByRequestedIds(
      [assetWithId(idAt(2))],
      [idAt(1), idAt(2), idAt(3)]
    );

    expect(assets.map((a) => a.id)).toEqual([idAt(2)]);
    expect(missing).toEqual([idAt(1), idAt(3)]);
  });

  it("reports non-uuid requests as missing rather than dropping them", () => {
    // selectLookupIds never queries these, so this is where the caller learns
    // they went nowhere.
    const { assets, missing } = orderAssetsByRequestedIds(
      [assetWithId(ID)],
      ["not-a-uuid", ID, "12345"]
    );

    expect(assets.map((a) => a.id)).toEqual([ID]);
    expect(missing).toEqual(["not-a-uuid", "12345"]);
  });

  it("collapses duplicate requests to one entry, case included", () => {
    const found = orderAssetsByRequestedIds(
      [assetWithId(HEX_ID)],
      [HEX_ID, HEX_ID, HEX_ID.toUpperCase()]
    );
    expect(found.assets.map((a) => a.id)).toEqual([HEX_ID]);
    expect(found.missing).toEqual([]);

    const absent = orderAssetsByRequestedIds([], [idAt(9), idAt(9)]);
    expect(absent.missing).toEqual([idAt(9)]);
  });

  it("ignores empty and whitespace-only entries entirely", () => {
    const { assets, missing } = orderAssetsByRequestedIds([], ["", "   "]);

    expect(assets).toEqual([]);
    expect(missing).toEqual([]);
  });
});
