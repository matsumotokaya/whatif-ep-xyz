import { beforeEach, describe, expect, it } from "vitest";
import {
  formatAspectRatio,
  isUuid,
  mapRowToRefDesign,
  mapRowToRefDesignLayers,
  orderByRequestedIds,
  parseRefDesignName,
  projectRefDesign,
  REF_DESIGN_FIELDS,
  REF_DESIGN_LIST_FIELDS,
  resolveRefDesignFields,
  selectLookupIds,
  stripImageExtension,
  type RefDesignLayersRow,
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

describe("parseRefDesignName", () => {
  // Real names taken from the owner's designs.
  it.each([
    ["EPISODE 0313-1 Feed", "0313-1", "Feed"],
    ["EPISODE 0459-1 Landscape", "0459-1", "Landscape"],
    ["EPISODE 0418-1 Portrait", "0418-1", "Portrait"],
    ["EPISODE 0443-1 Cover", "0443-1", "Cover"],
    // Shapes that exist in the data but do not carry a variant.
    ["EPISODE #0461", "0461", null],
    ["EPISODE 400", "400", null],
    // Names outside the convention parse to nothing rather than throwing.
    ["WTF-EXP-000001", null, null],
    ["無題のバナー", null, null],
  ])("parses %s", (name, episode, variant) => {
    expect(parseRefDesignName(name)).toEqual({ episode, variant });
  });

  it("returns nulls for an absent or blank name", () => {
    expect(parseRefDesignName(null)).toEqual({ episode: null, variant: null });
    expect(parseRefDesignName(undefined)).toEqual({
      episode: null,
      variant: null,
    });
    expect(parseRefDesignName("   ")).toEqual({ episode: null, variant: null });
  });

  it("only reads a variant that ends the name, as a whole word", () => {
    // "Feed" mid-name is part of a title, not the variant slot.
    expect(parseRefDesignName("Feed test 01").variant).toBeNull();
    // ...and a longer word merely ending in one of them is not a variant.
    expect(parseRefDesignName("EPISODE 0313-1 Newsfeed").variant).toBeNull();
    // Trailing whitespace still counts as the end.
    expect(parseRefDesignName("EPISODE 0313-1 Feed  ").variant).toBe("Feed");
  });

  it("normalizes the variant's casing", () => {
    expect(parseRefDesignName("episode 0313-1 feed")).toEqual({
      episode: "0313-1",
      variant: "Feed",
    });
  });
});

describe("formatAspectRatio", () => {
  it("reduces dimensions to their simplest ratio", () => {
    expect(formatAspectRatio(1080, 1350)).toBe("4:5");
    expect(formatAspectRatio(2560, 1440)).toBe("16:9");
    expect(formatAspectRatio(1440, 2560)).toBe("9:16");
    expect(formatAspectRatio(1080, 1080)).toBe("1:1");
    expect(formatAspectRatio(1080, 1920)).toBe("9:16");
  });

  it("returns null for anything it cannot reduce", () => {
    expect(formatAspectRatio(null, 1350)).toBeNull();
    expect(formatAspectRatio(1080, null)).toBeNull();
    expect(formatAspectRatio(0, 1350)).toBeNull();
    expect(formatAspectRatio(-1080, 1350)).toBeNull();
  });
});

describe("mapRowToRefDesign", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz";
  });

  it("resolves the full-res render against the assets origin", () => {
    const design = mapRowToRefDesign(row());

    expect(design.urlKind).toBe("full");
    expect(design.url).toBe(
      `https://assets.whatif-ep.xyz/user-images/uid/banners/${ID}/full/rev1.jpg?v=${encodeURIComponent(UPDATED_AT)}`
    );
    expect(design.thumbnailUrl).toContain("/thumb/rev1.jpg");
    expect(design.previewStatus).toBe("ready");
    expect(design.stale).toBe(false);
  });

  it("reports width/height as the dimensions of the image at `url`", () => {
    // The full-res render is produced at exactly the document dimensions, so
    // when there is one the two pairs agree.
    const design = mapRowToRefDesign(row());

    expect(design.width).toBe(1080);
    expect(design.height).toBe(1920);
    expect(design.docWidth).toBe(1080);
    expect(design.docHeight).toBe(1920);
  });

  it("builds stable ref and edit URLs from the site origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz/";
    const design = mapRowToRefDesign(row());

    expect(design.refUrl).toBe(`https://whatif-ep.xyz/ref/${ID}`);
    expect(design.editUrl).toBe(`https://whatif-ep.xyz/edit/${ID}`);
  });

  it("never lets a thumbnail stand in for the full-res render", () => {
    // The bug this API shipped once: `url` served a ~400px thumbnail while
    // width/height still advertised the document size, so a consumer fed a
    // paid video generator a low-res image and could not tell.
    const design = mapRowToRefDesign(row({ fullres_key: null }));

    expect(design.url).toBeNull();
    expect(design.urlKind).toBeNull();
    expect(design.width).toBeNull();
    expect(design.height).toBeNull();
    // The thumbnail is still offered, under its own name only.
    expect(design.thumbnailUrl).toContain("/thumb/rev1.jpg");
  });

  it("keeps the document dimensions and aspect for an unrendered design", () => {
    const design = mapRowToRefDesign(
      row({ fullres_key: null, template: { width: 1080, height: 1350 } })
    );

    expect(design.docWidth).toBe(1080);
    expect(design.docHeight).toBe(1350);
    expect(design.aspect).toBe("4:5");
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

  it("exposes the episode, variant and aspect parsed from the row", () => {
    const design = mapRowToRefDesign(
      row({
        name: "EPISODE 0459-1 Landscape",
        template: { width: 2560, height: 1440 },
      })
    );

    expect(design.episode).toBe("0459-1");
    expect(design.variant).toBe("Landscape");
    expect(design.aspect).toBe("16:9");
  });

  it("marks a design stale when the render is behind the document", () => {
    expect(mapRowToRefDesign(row({ preview_revision: 6 })).stale).toBe(true);
    expect(mapRowToRefDesign(row({ preview_status: "pending" })).stale).toBe(true);
    expect(mapRowToRefDesign(row({ preview_status: "failed" })).stale).toBe(true);
    expect(mapRowToRefDesign(row({ preview_status: null })).stale).toBe(true);
    // A document revision with no matching preview revision is a real mismatch.
    expect(mapRowToRefDesign(row({ preview_revision: null })).stale).toBe(true);
  });

  it("still tracks staleness for a design that only has a thumbnail", () => {
    // `stale` follows any render, not `url`, so a thumbnail-only design can
    // still warn that its preview is behind the document.
    const design = mapRowToRefDesign(
      row({ fullres_key: null, preview_revision: 6 })
    );

    expect(design.url).toBeNull();
    expect(design.stale).toBe(true);
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
    expect(design.docWidth).toBeNull();
    expect(design.docHeight).toBeNull();
    expect(design.aspect).toBeNull();
    expect(design.episode).toBeNull();
    expect(design.variant).toBeNull();
    expect(design.previewStatus).toBeNull();
  });
});

describe("field projection", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz";
  });

  it("lists every RefDesign key exactly once", () => {
    // `fields=all` projects REF_DESIGN_FIELDS, so a field missing from that
    // array would silently be unreachable.
    const design = mapRowToRefDesign(row());

    expect([...REF_DESIGN_FIELDS].sort()).toEqual(Object.keys(design).sort());
  });

  it("keeps the list shape a subsequence of the canonical order", () => {
    // Otherwise a record's keys would be ordered differently depending on
    // whether `fields` was passed.
    expect(
      REF_DESIGN_FIELDS.filter((field) =>
        (REF_DESIGN_LIST_FIELDS as readonly string[]).includes(field)
      )
    ).toEqual([...REF_DESIGN_LIST_FIELDS]);
  });

  it("defaults to the compact list shape", () => {
    expect(resolveRefDesignFields(undefined)).toEqual(REF_DESIGN_LIST_FIELDS);
    expect(resolveRefDesignFields(null)).toEqual(REF_DESIGN_LIST_FIELDS);
    expect(resolveRefDesignFields("  ")).toEqual(REF_DESIGN_LIST_FIELDS);

    const projected = projectRefDesign(
      mapRowToRefDesign(row()),
      resolveRefDesignFields(undefined)
    );

    expect(Object.keys(projected)).toEqual([...REF_DESIGN_LIST_FIELDS]);
    // The four-URLs-per-record payload is what made limit=200 unaffordable.
    expect(projected).not.toHaveProperty("refUrl");
    expect(projected).not.toHaveProperty("editUrl");
    expect(projected).not.toHaveProperty("thumbnailUrl");
    expect(projected).not.toHaveProperty("updatedAt");
    expect(projected).not.toHaveProperty("previewStatus");
  });

  it("returns exactly the named fields, not the compact shape plus them", () => {
    // The point of the breaking change: a caller naming four fields must stop
    // paying for the other six.
    expect(resolveRefDesignFields("id,name,aspect,url")).toEqual([
      "id",
      "name",
      "aspect",
      "url",
    ]);

    const projected = projectRefDesign(
      mapRowToRefDesign(row()),
      resolveRefDesignFields("refUrl,thumbnailUrl")
    );

    expect(Object.keys(projected)).toEqual(["id", "thumbnailUrl", "refUrl"]);
    expect(projected.refUrl).toBe(`https://whatif-ep.xyz/ref/${ID}`);
    expect(projected.thumbnailUrl).toContain("/thumb/rev1.jpg");
    expect(projected).not.toHaveProperty("editUrl");
    // Dropped, even though the compact record carries them.
    expect(projected).not.toHaveProperty("url");
    expect(projected).not.toHaveProperty("docWidth");
  });

  it("keeps `id` even when the caller does not name it", () => {
    // A record without its id cannot be looked up again, re-requested with
    // other fields, or turned into a /ref/ URL.
    expect(resolveRefDesignFields("name")).toEqual(["id", "name"]);
    expect(
      Object.keys(
        projectRefDesign(
          mapRowToRefDesign(row()),
          resolveRefDesignFields("url")
        )
      )
    ).toEqual(["id", "url"]);
  });

  it("reads an array of names exactly like the comma-separated string", () => {
    // An MCP client passes an array for a multi-valued argument; that used to
    // fail with a schema error before it ever reached this resolver.
    expect(resolveRefDesignFields(["id", "name"])).toEqual(
      resolveRefDesignFields("id,name")
    );
    expect(resolveRefDesignFields(["id,name", " aspect "])).toEqual([
      "id",
      "name",
      "aspect",
    ]);
    expect(resolveRefDesignFields([])).toEqual(REF_DESIGN_LIST_FIELDS);
    expect(resolveRefDesignFields(["all"])).toEqual(REF_DESIGN_FIELDS);
  });

  it("keys projected records in the canonical field order", () => {
    const projected = projectRefDesign(
      mapRowToRefDesign(row()),
      resolveRefDesignFields("updatedAt,episode")
    );

    // Canonical order, not the caller's argument order.
    expect(Object.keys(projected).indexOf("episode")).toBeLessThan(
      Object.keys(projected).indexOf("updatedAt")
    );
  });

  it("returns the full record for `all`, case-insensitively", () => {
    expect(resolveRefDesignFields("all")).toEqual(REF_DESIGN_FIELDS);
    expect(resolveRefDesignFields("ALL")).toEqual(REF_DESIGN_FIELDS);
    expect(resolveRefDesignFields("refUrl,all")).toEqual(REF_DESIGN_FIELDS);

    const projected = projectRefDesign(
      mapRowToRefDesign(row()),
      resolveRefDesignFields("all")
    );

    expect(Object.keys(projected)).toEqual([...REF_DESIGN_FIELDS]);
  });

  it("ignores unknown field names instead of failing the request", () => {
    // A client written against a later version of this API still gets a
    // useful response.
    expect(resolveRefDesignFields("nope, ,refUrl,also-not-a-field")).toEqual(
      resolveRefDesignFields("refUrl")
    );
    // Nothing recognisable was asked for, so the honest answer is ids alone —
    // still a response, never an error.
    expect(resolveRefDesignFields("totally-made-up")).toEqual(["id"]);
  });

  it("matches requested field names case-insensitively", () => {
    expect(resolveRefDesignFields("REFURL")).toContain("refUrl");
  });
});

// Ids that differ only in their last block, for bulk/cap cases.
const idAt = (n: number) =>
  `11111111-2222-4333-8444-${String(n).padStart(12, "0")}`;

// ID is all digits, so upper-casing it changes nothing; case handling needs a
// uuid that actually contains hex letters.
const HEX_ID = "aabbccdd-1122-4333-8444-abcdefabcdef";

const designWithId = (id: string) => mapRowToRefDesign(row({ id }));

describe("selectLookupIds", () => {
  it("keeps uuids in first-occurrence order and drops duplicates", () => {
    expect(
      selectLookupIds([idAt(2), idAt(1), idAt(2), idAt(1), idAt(3)])
    ).toEqual([idAt(2), idAt(1), idAt(3)]);
  });

  it("drops anything that could never match a banner id", () => {
    // Non-uuid input must not reach the `in` filter at all.
    expect(
      selectLookupIds(["", "   ", "not-a-uuid", `${ID}' or '1`, ID])
    ).toEqual([ID]);
  });

  it("trims and lower-cases so mixed-case input still matches a row id", () => {
    // Postgres hands back canonical lower-case uuids.
    expect(selectLookupIds([`  ${HEX_ID.toUpperCase()}  `])).toEqual([HEX_ID]);
    // ...and the case-folded form counts as the same id for deduping.
    expect(selectLookupIds([HEX_ID, HEX_ID.toUpperCase()])).toEqual([HEX_ID]);
  });

  it("caps one request at MAX_LIMIT ids", () => {
    const ids = Array.from({ length: 250 }, (_, i) => idAt(i));
    const lookupIds = selectLookupIds(ids);

    expect(lookupIds).toHaveLength(200);
    expect(lookupIds[0]).toBe(idAt(0));
    expect(lookupIds.at(-1)).toBe(idAt(199));
  });
});

describe("orderByRequestedIds", () => {
  it("returns the designs in the caller's order, not the query's", () => {
    const requested = [idAt(3), idAt(1), idAt(2)];
    const fetched = [idAt(1), idAt(2), idAt(3)].map(designWithId);

    const { designs, missing } = orderByRequestedIds(fetched, requested);

    expect(designs.map((d) => d.id)).toEqual(requested);
    expect(missing).toEqual([]);
  });

  it("reports unresolved ids in `missing`, in the requested order", () => {
    const { designs, missing } = orderByRequestedIds(
      [designWithId(idAt(2))],
      [idAt(1), idAt(2), idAt(3)]
    );

    expect(designs.map((d) => d.id)).toEqual([idAt(2)]);
    expect(missing).toEqual([idAt(1), idAt(3)]);
  });

  it("reports non-uuid requests as missing rather than dropping them", () => {
    // selectLookupIds never queries these, so this is where the caller learns
    // they went nowhere.
    const { designs, missing } = orderByRequestedIds(
      [designWithId(ID)],
      ["not-a-uuid", ID, "12345"]
    );

    expect(designs.map((d) => d.id)).toEqual([ID]);
    expect(missing).toEqual(["not-a-uuid", "12345"]);
  });

  it("collapses duplicate requests to one entry, case included", () => {
    const found = orderByRequestedIds(
      [designWithId(HEX_ID)],
      [HEX_ID, HEX_ID, HEX_ID.toUpperCase()]
    );
    expect(found.designs.map((d) => d.id)).toEqual([HEX_ID]);
    expect(found.missing).toEqual([]);

    const absent = orderByRequestedIds([], [idAt(9), idAt(9)]);
    expect(absent.missing).toEqual([idAt(9)]);
  });

  it("ignores empty and whitespace-only entries entirely", () => {
    const { designs, missing } = orderByRequestedIds([], ["", "   "]);

    expect(designs).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("accounts for every distinct requested id exactly once", () => {
    // The invariant getRefDesignsByIds leans on: whatever is dropped before the
    // query (non-uuid, past MAX_LIMIT) still surfaces as missing.
    const requested = [
      idAt(1),
      idAt(1),
      "nope",
      idAt(2),
      HEX_ID.toUpperCase(),
      HEX_ID,
    ];
    const { designs, missing } = orderByRequestedIds(
      [designWithId(idAt(2))],
      requested
    );

    expect(designs).toHaveLength(1);
    expect(missing).toEqual([idAt(1), "nope", HEX_ID]);
  });
});

describe("mapRowToRefDesignLayers", () => {
  // Shaped after the real row for 15866eb5-… (EPISODE 0313-1 Feed): a
  // user-images background, a default-images cutout, and two text elements.
  const layersRow = (
    overrides: Partial<RefDesignLayersRow> = {}
  ): RefDesignLayersRow => ({
    id: ID,
    name: "EPISODE 0313-1 Feed",
    template: { width: 1080, height: 1350 },
    canvas_color: "#808080",
    elements: [
      {
        id: "image-bg",
        type: "image",
        src: "user-images/uid/uploads/bg.jpg",
        x: -110,
        y: -6.85,
        width: 1348.21,
        height: 1789.75,
        visible: true,
        rotation: 0,
      },
      {
        id: "image-cutout",
        type: "image",
        src: "default-images/official/episode/0313-1/cutout.png",
        x: 150,
        y: 42.87,
        width: 782.84,
        height: 1320.52,
        opacity: 1,
        visible: true,
        rotation: 0,
      },
      {
        id: "text-title",
        type: "text",
        text: "/IMAGINE: EP0313",
        x: 45.72,
        y: 1262.83,
        fill: "#fd4d52",
        stroke: "#000000",
        fontSize: 55,
        fontFamily: '"Bebas Neue", sans-serif',
        fontWeight: 400,
        fillEnabled: true,
        strokeWidth: 2,
        letterSpacing: 0,
        strokeEnabled: false,
        visible: true,
      },
    ],
    ...overrides,
  });

  it("resolves an image layer's url exactly as the editor loads it, with the stored geometry", () => {
    const { layers } = mapRowToRefDesignLayers(layersRow());
    const [background, cutout] = layers;

    // resolveElementSrc: assets origin + the key, with the CORS-anonymous
    // cache-bust the editor's ImageRenderer also requests.
    expect(background.url).toBe(
      "https://assets.whatif-ep.xyz/user-images/uid/uploads/bg.jpg?v=cors-anon-v1"
    );
    expect(cutout.url).toBe(
      "https://assets.whatif-ep.xyz/default-images/official/episode/0313-1/cutout.png?v=cors-anon-v1"
    );

    expect(background).toMatchObject({
      type: "image",
      x: -110,
      y: -6.85,
      width: 1348.21,
      height: 1789.75,
      rotation: 0,
      opacity: 1,
    });
  });

  it("carries the text fields a renderer needs, with no size", () => {
    const { layers } = mapRowToRefDesignLayers(layersRow());
    const text = layers[2];

    expect(text).toMatchObject({
      index: 2,
      type: "text",
      text: "/IMAGINE: EP0313",
      x: 45.72,
      y: 1262.83,
      fontFamily: '"Bebas Neue", sans-serif',
      fontSize: 55,
      fontWeight: 400,
      letterSpacing: 0,
      fill: "#fd4d52",
      fillEnabled: true,
      stroke: "#000000",
      strokeWidth: 2,
      strokeEnabled: false,
    });
    // Konva measures the box from the content, so the document stores none and
    // guessing one here is what `exact: false` exists to avoid.
    expect(text.width).toBeNull();
    expect(text.height).toBeNull();
  });

  it("marks images and shapes exact and text approximate", () => {
    const { layers } = mapRowToRefDesignLayers(
      layersRow({
        elements: [
          ...(layersRow().elements ?? []),
          {
            id: "shape-1",
            type: "shape",
            shapeType: "rectangle",
            x: 10,
            y: 20,
            width: 100,
            height: 50,
            fill: "#000000",
            fillEnabled: true,
            stroke: "#ffffff",
            strokeWidth: 4,
            strokeEnabled: true,
            visible: true,
          },
        ],
      })
    );

    expect(layers.map((layer) => [layer.type, layer.exact])).toEqual([
      ["image", true],
      ["image", true],
      ["text", false],
      ["shape", true],
    ]);
    expect(layers[3]).toMatchObject({
      shapeType: "rectangle",
      width: 100,
      height: 50,
    });
  });

  it("omits elements hidden in the editor and renumbers what is left", () => {
    // `visible: false` elements are absent from the flattened render too, so a
    // consumer that draws everything it is handed lands on the same picture.
    const rows = layersRow().elements ?? [];
    const { layers } = mapRowToRefDesignLayers(
      layersRow({
        elements: [
          { ...(rows[0] as object), visible: false },
          rows[1],
          rows[2],
        ],
      })
    );

    expect(layers).toHaveLength(2);
    expect(layers.map((layer) => layer.index)).toEqual([0, 1]);
    expect(layers[0].url).toContain("cutout.png");
  });

  it("preserves the stored draw order, bottom first", () => {
    const { layers } = mapRowToRefDesignLayers(layersRow());

    expect(layers.map((layer) => layer.index)).toEqual([0, 1, 2]);
    // Element 0 is the background and the last one is drawn on top.
    expect(layers[0].url).toContain("bg.jpg");
    expect(layers.at(-1)?.type).toBe("text");
  });

  it("reports the canvas, and fidelity.text approximate when there is text", () => {
    const design = mapRowToRefDesignLayers(layersRow());

    expect(design).toMatchObject({
      id: ID,
      name: "EPISODE 0313-1 Feed",
      width: 1080,
      height: 1350,
      backgroundColor: "#808080",
    });
    expect(design.fidelity.images).toBe("exact");
    expect(design.fidelity.text).toBe("approximate");
    expect(design.fidelity.note).toContain("Konva");
  });

  it("reports fidelity.text `none` for a design with no text at all", () => {
    const design = mapRowToRefDesignLayers(
      layersRow({ elements: (layersRow().elements ?? []).slice(0, 2) })
    );

    expect(design.fidelity.text).toBe("none");
    expect(design.fidelity.note).toContain("no text");
    expect(design.layers.every((layer) => layer.exact)).toBe(true);
  });

  it("survives a row with no elements", () => {
    const design = mapRowToRefDesignLayers(layersRow({ elements: null }));

    expect(design.layers).toEqual([]);
    expect(design.fidelity.text).toBe("none");
  });

  it("defaults rotation to 0 and opacity to 1 when unset", () => {
    const { layers } = mapRowToRefDesignLayers(
      layersRow({
        elements: [
          {
            id: "image-bare",
            type: "image",
            src: "default-images/library/a.png",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
          },
        ],
      })
    );

    expect(layers[0].rotation).toBe(0);
    expect(layers[0].opacity).toBe(1);
  });
});
