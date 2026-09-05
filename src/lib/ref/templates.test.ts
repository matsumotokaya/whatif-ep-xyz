import { beforeEach, describe, expect, it } from "vitest";
import {
  mapRowToRefTemplate,
  mapRowToRefTemplateLayers,
  orderTemplatesByRequestedIds,
  projectRefTemplate,
  REF_TEMPLATE_FIELDS,
  REF_TEMPLATE_LIST_FIELDS,
  resolveRefTemplateFields,
  type RefTemplate,
  type RefTemplateLayersRow,
  type RefTemplateRow,
} from "./templates";

const UPDATED_AT = "2026-09-05T09:30:00.000Z";
const ID = "33333333-4444-4555-8666-777777777777";
// The key shape buildTemplateThumbKey writes: already logical-bucket-prefixed.
const THUMBNAIL_KEY = `default-images/templates/${ID}/thumb/rev1.jpg`;
const THUMBNAIL_URL = `https://assets.whatif-ep.xyz/${THUMBNAIL_KEY}?v=${encodeURIComponent(UPDATED_AT)}`;

// Shaped after a real public.templates row.
function row(overrides: Partial<RefTemplateRow> = {}): RefTemplateRow {
  return {
    id: ID,
    name: "EPISODE Feed 4:5",
    canvas_color: "#101010",
    thumbnail_url: null,
    thumbnail_key: THUMBNAIL_KEY,
    plan_type: "free",
    is_public: true,
    display_order: 3,
    width: 1080,
    height: 1350,
    like_count: 12,
    open_count: 48,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

describe("mapRowToRefTemplate", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz";
  });

  it("resolves the thumbnail against the assets origin, versioned by updated_at", () => {
    // Byte for byte templateStorage.ts's own resolution, so a ref thumbnail and
    // the gallery thumbnail are the same cached object.
    const template = mapRowToRefTemplate(row());

    expect(template.thumbnailUrl).toBe(THUMBNAIL_URL);
  });

  it("reports the canvas size and ratio unconditionally", () => {
    // Unlike the design side, these come from the row's own integer columns and
    // describe the DOCUMENT, not an image — so nothing here is withheld when
    // there is no picture to point at, because nothing here is a claim about a
    // file the caller might go and fetch.
    const template = mapRowToRefTemplate(
      row({ thumbnail_key: null, thumbnail_url: null })
    );

    expect(template.thumbnailUrl).toBeNull();
    expect(template.width).toBe(1080);
    expect(template.height).toBe(1350);
    expect(template.aspect).toBe("4:5");
  });

  it("builds the layers URL under the template namespace", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz/";
    const template = mapRowToRefTemplate(row());

    // A pure function of `id`: the layers ARE the value of this kind, so the
    // one URL a template has must always be reachable.
    expect(template.layersUrl).toBe(
      `https://whatif-ep.xyz/api/ref/templates/${ID}/layers`
    );
  });

  it("carries the template's own metadata through unchanged", () => {
    const template = mapRowToRefTemplate(row());

    expect(template.id).toBe(ID);
    expect(template.name).toBe("EPISODE Feed 4:5");
    expect(template.planType).toBe("free");
    expect(template.isPublic).toBe(true);
    expect(template.backgroundColor).toBe("#101010");
    expect(template.openCount).toBe(48);
    expect(template.likeCount).toBe(12);
    expect(template.updatedAt).toBe(UPDATED_AT);
  });

  it("prefers the key column over the legacy full-URL column", () => {
    // Both columns are populated on rows migrated to R2; the key is the current
    // target and the URL is only there for rows that never got one.
    const template = mapRowToRefTemplate(
      row({ thumbnail_url: "https://legacy.example.com/old-thumb.jpg" })
    );

    expect(template.thumbnailUrl).toBe(THUMBNAIL_URL);
  });

  it("falls back to the legacy thumbnail_url column", () => {
    const template = mapRowToRefTemplate(
      row({
        thumbnail_key: null,
        thumbnail_url: `https://assets.whatif-ep.xyz/default-images/templates/${ID}/thumb/legacy.jpg`,
      })
    );

    expect(template.thumbnailUrl).toBe(
      `https://assets.whatif-ep.xyz/default-images/templates/${ID}/thumb/legacy.jpg?v=${encodeURIComponent(UPDATED_AT)}`
    );
  });

  it("reports no thumbnail when the row has neither column", () => {
    const template = mapRowToRefTemplate(
      row({ thumbnail_key: null, thumbnail_url: null })
    );

    expect(template.thumbnailUrl).toBeNull();
  });

  it("normalizes a missing name, canvas colour, publish flag and counters", () => {
    const template = mapRowToRefTemplate(
      row({
        name: null,
        canvas_color: null,
        plan_type: null,
        is_public: null,
        width: null,
        height: null,
        like_count: null,
        open_count: null,
      })
    );

    expect(template.name).toBe("");
    // The editor's own default when a document carries no canvas colour.
    expect(template.backgroundColor).toBe("#ffffff");
    // An unset flag must not read as published.
    expect(template.isPublic).toBe(false);
    expect(template.planType).toBeNull();
    expect(template.width).toBeNull();
    expect(template.height).toBeNull();
    expect(template.aspect).toBeNull();
    expect(template.likeCount).toBeNull();
    expect(template.openCount).toBeNull();
  });
});

// Compile-time half of the guard below: `url` is not a key of RefTemplate, so
// this resolves to `true`. Adding one would make it `false`, and assigning
// `true` to it would fail `tsc --noEmit` before any test could run.
type TemplateHasNoUrlField = [Extract<keyof RefTemplate, "url">] extends [never]
  ? true
  : false;
const TEMPLATE_HAS_NO_URL_FIELD: TemplateHasNoUrlField = true;

describe("a template has no full-size image", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz";
  });

  // 🔴 The single most important guarantee in this module. `public.templates`
  // has no fullres column and no template has ever been rendered at full size,
  // so a `url` here could only ever be the ~400px thumbnail wearing the name of
  // a full-size source. The design side shipped exactly that once: a consumer
  // fed the preview to a paid, per-call video generator believing it held the
  // full resolution, and only found out after paying for the render. If one of
  // these ever fails, do not "fix" the test — the field must not exist.
  it("never offers a `url`, on the type, the field list or a mapped record", () => {
    const template = mapRowToRefTemplate(row());

    expect(TEMPLATE_HAS_NO_URL_FIELD).toBe(true);
    expect(REF_TEMPLATE_FIELDS).not.toContain("url");
    expect(REF_TEMPLATE_LIST_FIELDS).not.toContain("url");
    expect(Object.keys(template)).not.toContain("url");
    expect(template).not.toHaveProperty("url");
    // Not even the widest possible request can produce one.
    expect(
      projectRefTemplate(template, resolveRefTemplateFields("all"))
    ).not.toHaveProperty("url");
  });

  it("does not resolve `url` as a field name", () => {
    // It is an unknown name here, so it is ignored like any other — the caller
    // gets ids alone rather than a thumbnail under the wrong name.
    expect(resolveRefTemplateFields("url")).toEqual(["id"]);
    expect(resolveRefTemplateFields("id,url,thumbnailUrl")).toEqual([
      "id",
      "thumbnailUrl",
    ]);
  });

  it("names the one image it does have for what it is", () => {
    const template = mapRowToRefTemplate(row());

    // Its pixel size is not recorded and is deliberately not reported, so
    // width/height can never be read as the size of this file.
    expect(template.thumbnailUrl).toBe(THUMBNAIL_URL);
    expect(REF_TEMPLATE_FIELDS).toContain("thumbnailUrl");
  });
});

describe("field projection", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://whatif-ep.xyz";
  });

  it("lists every RefTemplate key exactly once", () => {
    // `fields=all` projects REF_TEMPLATE_FIELDS, so a field missing from that
    // array would silently be unreachable.
    const template = mapRowToRefTemplate(row());

    expect([...REF_TEMPLATE_FIELDS].sort()).toEqual(
      Object.keys(template).sort()
    );
  });

  it("keeps the list shape a subsequence of the canonical order", () => {
    // Otherwise a record's keys would be ordered differently depending on
    // whether `fields` was passed.
    expect(
      REF_TEMPLATE_FIELDS.filter((field) =>
        (REF_TEMPLATE_LIST_FIELDS as readonly string[]).includes(field)
      )
    ).toEqual([...REF_TEMPLATE_LIST_FIELDS]);
  });

  it("defaults to the compact list shape", () => {
    expect(resolveRefTemplateFields(undefined)).toEqual(
      REF_TEMPLATE_LIST_FIELDS
    );
    expect(resolveRefTemplateFields(null)).toEqual(REF_TEMPLATE_LIST_FIELDS);
    expect(resolveRefTemplateFields("  ")).toEqual(REF_TEMPLATE_LIST_FIELDS);

    const projected = projectRefTemplate(
      mapRowToRefTemplate(row()),
      resolveRefTemplateFields(undefined)
    );

    expect(Object.keys(projected)).toEqual([...REF_TEMPLATE_LIST_FIELDS]);
    // `layersUrl` is a pure function of `id` and the colour only matters once
    // you are rendering, so a listing pays for neither.
    expect(projected).not.toHaveProperty("layersUrl");
    expect(projected).not.toHaveProperty("backgroundColor");
    expect(projected).not.toHaveProperty("isPublic");
    expect(projected).not.toHaveProperty("openCount");
    expect(projected).not.toHaveProperty("updatedAt");
  });

  it("returns exactly the named fields, not the compact shape plus them", () => {
    expect(resolveRefTemplateFields("id,name,aspect,layersUrl")).toEqual([
      "id",
      "name",
      "aspect",
      "layersUrl",
    ]);

    const projected = projectRefTemplate(
      mapRowToRefTemplate(row()),
      resolveRefTemplateFields("layersUrl,backgroundColor")
    );

    expect(Object.keys(projected)).toEqual([
      "id",
      "backgroundColor",
      "layersUrl",
    ]);
    expect(projected.layersUrl).toBe(
      `https://whatif-ep.xyz/api/ref/templates/${ID}/layers`
    );
    expect(projected.backgroundColor).toBe("#101010");
    // Dropped, even though the compact record carries them.
    expect(projected).not.toHaveProperty("name");
    expect(projected).not.toHaveProperty("thumbnailUrl");
  });

  it("keeps `id` even when the caller does not name it", () => {
    expect(resolveRefTemplateFields("name")).toEqual(["id", "name"]);
    expect(
      Object.keys(
        projectRefTemplate(
          mapRowToRefTemplate(row()),
          resolveRefTemplateFields("layersUrl")
        )
      )
    ).toEqual(["id", "layersUrl"]);
  });

  it("reads an array of names exactly like the comma-separated string", () => {
    // An MCP client passes an array for a multi-valued argument.
    expect(resolveRefTemplateFields(["id", "name"])).toEqual(
      resolveRefTemplateFields("id,name")
    );
    expect(resolveRefTemplateFields(["id,name", " aspect "])).toEqual([
      "id",
      "name",
      "aspect",
    ]);
    expect(resolveRefTemplateFields([])).toEqual(REF_TEMPLATE_LIST_FIELDS);
    expect(resolveRefTemplateFields(["all"])).toEqual(REF_TEMPLATE_FIELDS);
  });

  it("keys projected records in the canonical field order", () => {
    const projected = projectRefTemplate(
      mapRowToRefTemplate(row()),
      resolveRefTemplateFields("updatedAt,planType")
    );

    // Canonical order, not the caller's argument order.
    expect(Object.keys(projected).indexOf("planType")).toBeLessThan(
      Object.keys(projected).indexOf("updatedAt")
    );
  });

  it("returns the full record for `all`, case-insensitively", () => {
    expect(resolveRefTemplateFields("all")).toEqual(REF_TEMPLATE_FIELDS);
    expect(resolveRefTemplateFields("ALL")).toEqual(REF_TEMPLATE_FIELDS);
    expect(resolveRefTemplateFields("layersUrl,all")).toEqual(
      REF_TEMPLATE_FIELDS
    );

    const projected = projectRefTemplate(
      mapRowToRefTemplate(row()),
      resolveRefTemplateFields("all")
    );

    expect(Object.keys(projected)).toEqual([...REF_TEMPLATE_FIELDS]);
  });

  it("ignores unknown field names instead of failing the request", () => {
    // A client written against a later version of this API still gets a
    // useful response.
    expect(
      resolveRefTemplateFields("nope, ,layersUrl,also-not-a-field")
    ).toEqual(resolveRefTemplateFields("layersUrl"));
    // Nothing recognisable was asked for, so the honest answer is ids alone.
    expect(resolveRefTemplateFields("totally-made-up")).toEqual(["id"]);
  });

  it("matches requested field names case-insensitively", () => {
    expect(resolveRefTemplateFields("LAYERSURL")).toContain("layersUrl");
  });
});

describe("mapRowToRefTemplateLayers", () => {
  // Shaped after a real public.templates row: a background image, a cutout and
  // one text element. The canvas size lives in real `width`/`height` COLUMNS
  // here, where a design keeps it inside its `template` jsonb — adapting that
  // one difference is the whole job of this mapper.
  const layersRow = (
    overrides: Partial<RefTemplateLayersRow> = {}
  ): RefTemplateLayersRow => ({
    id: ID,
    name: "EPISODE Feed 4:5",
    canvas_color: "#808080",
    width: 1080,
    height: 1350,
    elements: [
      {
        id: "image-bg",
        type: "image",
        src: "default-images/templates/bg.jpg",
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
        fontSize: 55,
        fontFamily: '"Bebas Neue", sans-serif',
        fontWeight: 400,
        fillEnabled: true,
        letterSpacing: 0,
        visible: true,
      },
    ],
    ...overrides,
  });

  it("carries the row's own width/height columns through as the canvas", () => {
    // The adaptation this mapper exists for: the design mapper reads
    // `template.width`/`template.height`, so a template whose columns were not
    // wrapped would report a canvas of null and give a renderer nothing to
    // place its layers on.
    const layers = mapRowToRefTemplateLayers(layersRow());

    expect(layers).toMatchObject({
      id: ID,
      name: "EPISODE Feed 4:5",
      width: 1080,
      height: 1350,
      backgroundColor: "#808080",
    });
  });

  it("reports no canvas rather than a wrong one when the columns are empty", () => {
    const layers = mapRowToRefTemplateLayers(
      layersRow({ width: null, height: null, canvas_color: null })
    );

    expect(layers.width).toBeNull();
    expect(layers.height).toBeNull();
    expect(layers.backgroundColor).toBe("#ffffff");
  });

  it("resolves an image layer's url exactly as the editor loads it, with the stored geometry", () => {
    const { layers } = mapRowToRefTemplateLayers(layersRow());
    const [background, cutout] = layers;

    // resolveElementSrc: assets origin + the key, with the CORS-anonymous
    // cache-bust the editor's ImageRenderer also requests.
    expect(background.url).toBe(
      "https://assets.whatif-ep.xyz/default-images/templates/bg.jpg?v=cors-anon-v1"
    );
    expect(cutout.url).toBe(
      "https://assets.whatif-ep.xyz/default-images/official/episode/0313-1/cutout.png?v=cors-anon-v1"
    );

    expect(background).toMatchObject({
      index: 0,
      type: "image",
      x: -110,
      y: -6.85,
      width: 1348.21,
      height: 1789.75,
      rotation: 0,
      opacity: 1,
      // An image layer placed at this geometry reproduces the render.
      exact: true,
    });
  });

  it("carries the text fields a renderer needs, with no size", () => {
    const { layers } = mapRowToRefTemplateLayers(layersRow());
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
    });
    // Konva measures the box from the content, so the document stores none and
    // guessing one here is what `exact: false` exists to avoid.
    expect(text.width).toBeNull();
    expect(text.height).toBeNull();
    expect(text.exact).toBe(false);
  });

  it("omits elements hidden in the editor and renumbers what is left", () => {
    // `visible: false` elements are absent from the flattened render too, so a
    // consumer that draws everything it is handed lands on the same picture —
    // and a renumbered `index` leaves no gaps to interpret.
    const elements = layersRow().elements ?? [];
    const { layers } = mapRowToRefTemplateLayers(
      layersRow({
        elements: [
          { ...(elements[0] as object), visible: false },
          elements[1],
          elements[2],
        ],
      })
    );

    expect(layers).toHaveLength(2);
    expect(layers.map((layer) => layer.index)).toEqual([0, 1]);
    expect(layers[0].url).toContain("cutout.png");
  });

  it("preserves the stored draw order, bottom first", () => {
    const { layers } = mapRowToRefTemplateLayers(layersRow());

    expect(layers.map((layer) => layer.index)).toEqual([0, 1, 2]);
    expect(layers[0].url).toContain("bg.jpg");
    expect(layers.at(-1)?.type).toBe("text");
  });

  it("reports fidelity.text approximate when the template has text", () => {
    const { fidelity } = mapRowToRefTemplateLayers(layersRow());

    expect(fidelity.images).toBe("exact");
    expect(fidelity.text).toBe("approximate");
    expect(fidelity.note).toContain("Konva");
  });

  it("reports fidelity.text `none` for a template with no text at all", () => {
    // Nothing in such a template is approximate, and a consumer can render it
    // with no caveat at all.
    const { fidelity, layers } = mapRowToRefTemplateLayers(
      layersRow({ elements: (layersRow().elements ?? []).slice(0, 2) })
    );

    expect(fidelity.text).toBe("none");
    expect(fidelity.note).toContain("no text");
    expect(layers.every((layer) => layer.exact)).toBe(true);
  });

  it("survives a row with no elements", () => {
    // `elements` is NOT NULL on this table, so this is a guard rather than a
    // code path — but a null must not throw on the way to a 200.
    const { layers, fidelity } = mapRowToRefTemplateLayers(
      layersRow({ elements: null })
    );

    expect(layers).toEqual([]);
    expect(fidelity.text).toBe("none");
  });
});

// Ids that differ only in their last block.
const idAt = (n: number) =>
  `33333333-4444-4555-8666-${String(n).padStart(12, "0")}`;

// A uuid with hex letters, so upper-casing it actually changes the string.
const HEX_ID = "aabbccdd-1122-4333-8444-abcdefabcdef";

const templateWithId = (id: string) => mapRowToRefTemplate(row({ id }));

describe("orderTemplatesByRequestedIds", () => {
  it("returns the templates in the caller's order, not the query's", () => {
    const requested = [idAt(3), idAt(1), idAt(2)];
    const fetched = [idAt(1), idAt(2), idAt(3)].map(templateWithId);

    const { templates, missing } = orderTemplatesByRequestedIds(
      fetched,
      requested
    );

    expect(templates.map((t) => t.id)).toEqual(requested);
    expect(missing).toEqual([]);
  });

  it("reports unresolved ids in `missing`, in the requested order", () => {
    const { templates, missing } = orderTemplatesByRequestedIds(
      [templateWithId(idAt(2))],
      [idAt(1), idAt(2), idAt(3)]
    );

    expect(templates.map((t) => t.id)).toEqual([idAt(2)]);
    expect(missing).toEqual([idAt(1), idAt(3)]);
  });

  it("reports non-uuid requests as missing rather than dropping them", () => {
    // selectLookupIds never queries these, so this is where the caller learns
    // they went nowhere.
    const { templates, missing } = orderTemplatesByRequestedIds(
      [templateWithId(ID)],
      ["not-a-uuid", ID, "12345"]
    );

    expect(templates.map((t) => t.id)).toEqual([ID]);
    expect(missing).toEqual(["not-a-uuid", "12345"]);
  });

  it("accounts for every distinct requested id exactly once", () => {
    // The invariant getRefTemplatesByIds leans on: whatever is dropped before
    // the query (non-uuid, duplicate, past MAX_LIMIT) still surfaces as
    // missing, and case-folded duplicates count as one id.
    const requested = [
      idAt(1),
      idAt(1),
      "nope",
      idAt(2),
      HEX_ID.toUpperCase(),
      HEX_ID,
    ];
    const { templates, missing } = orderTemplatesByRequestedIds(
      [templateWithId(idAt(2))],
      requested
    );

    expect(templates.map((t) => t.id)).toEqual([idAt(2)]);
    expect(missing).toEqual([idAt(1), "nope", HEX_ID]);
    // 4 distinct ids requested, each accounted for exactly once.
    expect(templates.length + missing.length).toBe(4);
  });

  it("ignores empty and whitespace-only entries entirely", () => {
    const { templates, missing } = orderTemplatesByRequestedIds([], ["", "   "]);

    expect(templates).toEqual([]);
    expect(missing).toEqual([]);
  });
});
