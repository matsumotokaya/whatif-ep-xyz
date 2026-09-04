import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAsset, resolveElementSrc } from "@/lib/asset";
import type { CanvasElement } from "@/components/editor/types/template";
import {
  clampLimit,
  clampOffset,
  formatAspectRatio,
  getSiteUrl,
  isUuid,
  normalizeId,
  normalizeMinWidth,
  orderByRequestedIds as orderRecordsByRequestedIds,
  projectRefRecord,
  resolveRefFields,
  selectLookupIds,
  stripImageExtension,
  toFiniteNumber,
} from "./common";

// Ref Library: exposes saved IMAGINE designs (public.banners) as public image
// references so external tools — MCP clients, curl/CLI, Remotion,
// video-generation APIs — can point at a rendered design by URL instead of
// re-exporting and re-uploading files by hand.
//
// This module covers ONE of the Ref Library's two referenceable kinds. The
// other — the site's official, curated image library (public.default_images) —
// lives in ./assets.ts, which is public data end to end and therefore has no
// owner scoping at all. Kind-agnostic pure helpers are shared through
// ./common.ts; nothing that decides a kind's scope belongs there.
//
// TRUST MODEL: the design uuid is the capability. Anyone who knows an id may
// resolve it, whoever owns the design, exactly like the R2 objects behind it —
// those keys are world-readable with permissive CORS, so a resolvable id was
// never more secret than the image it points at. Users hand their own id or
// /ref/{id} URL to a video AI, a CLI or another person, and it has to work
// without an account.
//
// ...but ENUMERATION STAYS OWNER-SCOPED, and that asymmetry is the whole
// design, not an oversight to tidy up later. Obscurity only protects a design
// while its id stays unguessable, so the unfiltered listing and the name search
// remain restricted to the configured "ref owner" accounts
// (REF_OWNER_USER_IDS, falling back to profiles.role = 'admin'). Opening those
// to everyone would let one request walk every design of every user, which is
// precisely what an id-as-capability model cannot survive. Adding an owner
// filter to the id path, or dropping it from the listing, each break one half of
// this contract — see docs/REF_LIBRARY.md.
//
// Every query below uses the service-role client, so RLS is bypassed by design
// and the scope of each function is whatever its own query says it is. Hence the
// two entry points are separate, named functions rather than one function with
// a flag that quietly changes its security posture:
//
//   listRefDesigns()      owner-scoped   browse / search
//   getRefDesignsByIds()  unscoped       exact id lookup
//
// Rendered previews live in R2 under immutable, revisioned keys
// (user-images/{uid}/banners/{bannerId}/full/{revision}.jpg), so the resolved
// URLs can be handed straight to any consumer.
//
// `url` IS THE FULL-RESOLUTION RENDER OR NOTHING. It used to fall back to the
// thumbnail so that every design carried some image, but `width`/`height` kept
// reporting the document's dimensions, so a consumer that trusted them fed a
// ~400px thumbnail into a paid, per-call video generator believing it was
// 1080x1350 — and nothing downstream rejected it. The two images are now kept
// apart: `url` is the full-res render (null when there is none) and
// `width`/`height` describe THAT image exactly, `thumbnailUrl` is the small
// preview under its own name, and `docWidth`/`docHeight` carry the document's
// own dimensions whether or not anything has been rendered. Never let `url`
// point at a thumbnail again.

// Upper bound for the one query that has to be filtered in JS (see minWidth in
// listRefDesigns). Matches Supabase's default PostgREST max-rows, so asking for
// more would not return more anyway.
const MAX_SCAN_ROWS = 1000;

// Kind-agnostic helpers now live in ./common (shared with assets.ts) and are
// re-exported here so existing importers of this module keep working.
export { formatAspectRatio, isUuid, selectLookupIds, stripImageExtension };

export type RefDesignVariant = "Feed" | "Landscape" | "Portrait" | "Cover";

export interface RefDesign {
  id: string;
  name: string;
  // Parsed out of `name`, best effort — null for any name that does not follow
  // the owner's convention. See parseRefDesignName.
  episode: string | null;
  variant: RefDesignVariant | null;
  // Reduced ratio of the document dimensions, e.g. "4:5". Available even when
  // nothing has been rendered, because it comes from docWidth/docHeight.
  aspect: string | null;
  // Dimensions of the image at `url`, exactly. Null whenever `url` is null:
  // there is no image to describe, and guessing would be the bug this API
  // already shipped once.
  width: number | null;
  height: number | null;
  // The design document's own dimensions, independent of any render.
  docWidth: number | null;
  docHeight: number | null;
  // Full-resolution render only. Never the thumbnail.
  url: string | null;
  // Only ever "full" or null now that `url` cannot be a thumbnail. Kept as a
  // field because consumers already read it.
  urlKind: "full" | null;
  // Small preview, roughly 400px wide but not exactly: two generators produce
  // it and legacy rows came from a third, so its pixel size is not derivable
  // and is deliberately not reported.
  thumbnailUrl: string | null;
  refUrl: string;
  editUrl: string;
  updatedAt: string;
  previewStatus: "pending" | "ready" | "failed" | null;
  stale: boolean;
}

// Canonical field order, used for `fields=all` and to keep projected records in
// a stable key order. designs.test.ts asserts it covers RefDesign exactly.
export const REF_DESIGN_FIELDS = [
  "id",
  "name",
  "episode",
  "variant",
  "aspect",
  "width",
  "height",
  "docWidth",
  "docHeight",
  "url",
  "urlKind",
  "thumbnailUrl",
  "refUrl",
  "editUrl",
  "updatedAt",
  "previewStatus",
  "stale",
] as const satisfies readonly (keyof RefDesign)[];

export type RefDesignField = (typeof REF_DESIGN_FIELDS)[number];

// Default shape of a LIST record, used when the caller names no `fields`.
// Listings are the expensive response — at limit=200 the old full record cost
// ~46k tokens for an LLM client, most of it four URLs per design that all embed
// the same uuid — so the derivable and the rarely-read fields are left out.
// `refUrl` and `editUrl` in particular are pure functions of `id`.
//
// A caller that wants something else names it: `fields` returns exactly the
// fields listed (plus `id`), so this shape is a default, not a floor.
//
// Declared in REF_DESIGN_FIELDS order (it is a subsequence of it, asserted in
// designs.test.ts) so that projected records key the same way whether or not
// `fields` was used. Only the set matters, not this order.
export const REF_DESIGN_LIST_FIELDS = [
  "id",
  "name",
  "aspect",
  "width",
  "height",
  "docWidth",
  "docHeight",
  "url",
  "urlKind",
  "stale",
] as const satisfies readonly RefDesignField[];

export type ProjectedRefDesign = Partial<RefDesign>;

// Pure. Resolves a caller's `fields` request into the field list to project.
// Absent -> the compact list shape; "all" -> every field; otherwise EXACTLY the
// recognised names asked for, plus `id`. `fields` selects rather than adds, so
// a caller can shrink a listing and not only widen it. Unknown names are
// ignored rather than rejected, so a client written against a later version of
// this API still gets a useful response. Accepts the comma-separated string an
// HTTP query carries and the array an MCP client tends to send.
export function resolveRefDesignFields(
  raw: string | readonly string[] | null | undefined,
  // What "no `fields` at all" means for the caller. A listing defaults to the
  // compact record; the id-lookup path passes REF_DESIGN_FIELDS, because a
  // caller naming exact ids has said what it wants and gets the full record.
  defaultFields: readonly RefDesignField[] = REF_DESIGN_LIST_FIELDS
): readonly RefDesignField[] {
  return resolveRefFields(raw, REF_DESIGN_FIELDS, defaultFields);
}

// Pure. Narrows one design down to the requested fields, in canonical order.
export function projectRefDesign(
  design: RefDesign,
  fields: readonly RefDesignField[]
): ProjectedRefDesign {
  return projectRefRecord(design, fields);
}

export function projectRefDesigns(
  designs: readonly RefDesign[],
  fields: readonly RefDesignField[]
): ProjectedRefDesign[] {
  return designs.map((design) => projectRefDesign(design, fields));
}

// Shape of the columns this module selects from public.banners.
export interface RefDesignRow {
  id: string;
  name: string | null;
  template: { width?: number | null; height?: number | null } | null;
  thumbnail_key: string | null;
  fullres_key: string | null;
  thumbnail_url: string | null;
  fullres_url: string | null;
  preview_status: string | null;
  document_revision: number | string | null;
  preview_revision: number | string | null;
  updated_at: string;
}

const REF_DESIGN_COLUMNS =
  "id, name, template, thumbnail_key, fullres_key, thumbnail_url, fullres_url, preview_status, document_revision, preview_revision, updated_at";

// PostgREST `or` group for "has a full-res render". Two columns because the
// asset moved from an absolute URL (legacy rows) to a relative R2 key.
const HAS_FULLRES_FILTER = "fullres_key.not.is.null,fullres_url.not.is.null";

// PostgREST's 416 for a range that starts past the last row.
const RANGE_NOT_SATISFIABLE = "PGRST103";

const PREVIEW_STATUSES = new Set(["pending", "ready", "failed"]);

const normalizePreviewStatus = (
  value: string | null
): RefDesign["previewStatus"] =>
  value && PREVIEW_STATUSES.has(value)
    ? (value as RefDesign["previewStatus"])
    : null;

const VARIANTS: readonly RefDesignVariant[] = [
  "Feed",
  "Landscape",
  "Portrait",
  "Cover",
];

const VARIANT_BY_LOWERCASE = new Map<string, RefDesignVariant>(
  VARIANTS.map((variant) => [variant.toLowerCase(), variant])
);

// Owner designs are named "EPISODE 0313-1 Feed". Real rows also hold
// "EPISODE #0461" and "EPISODE 400" (no sub-number, no variant), plus names
// with no structure at all ("WTF-EXP-000001", Japanese titles).
const EPISODE_PATTERN = /episode\s*#?\s*(\d+(?:-\d+)?)/i;
const VARIANT_PATTERN = /\b(feed|landscape|portrait|cover)\s*$/i;

export interface RefDesignNameParts {
  episode: string | null;
  variant: RefDesignVariant | null;
}

/**
 * Pure, best effort, never throws. Pulls the episode number and the variant
 * word out of a design name so consumers stop re-implementing this parse (and
 * stop filtering "16:9" by running `search=Landscape` and doing arithmetic on
 * the dimensions). Anything that does not match the convention yields null —
 * an unconventional name is normal, not an error.
 */
export function parseRefDesignName(
  name: string | null | undefined
): RefDesignNameParts {
  const value = typeof name === "string" ? name.trim() : "";
  if (value.length === 0) return { episode: null, variant: null };

  const episodeMatch = EPISODE_PATTERN.exec(value);
  const variantMatch = VARIANT_PATTERN.exec(value);

  return {
    episode: episodeMatch?.[1] ?? null,
    variant: variantMatch
      ? (VARIANT_BY_LOWERCASE.get(variantMatch[1].toLowerCase()) ?? null)
      : null,
  };
}

// Banner asset columns hold either a relative R2 key (current) or a legacy
// absolute URL (pre-R2 rows); resolveAsset normalizes both. `updated_at` is the
// cache-busting version, matching the editor-side resolver in bannerStorage.
const resolveBannerAsset = (
  key: string | null,
  legacyUrl: string | null,
  updatedAt: string
): string | null => {
  const value = key || legacyUrl;
  if (!value) return null;
  return (
    resolveAsset(value, { version: updatedAt, legacyBucket: "user-images" }) ||
    null
  );
};

// Pure row -> RefDesign mapping, kept free of Supabase and env lookups beyond
// the site origin so it can be unit tested directly.
export function mapRowToRefDesign(row: RefDesignRow): RefDesign {
  const siteUrl = getSiteUrl();
  const url = resolveBannerAsset(
    row.fullres_key,
    row.fullres_url,
    row.updated_at
  );
  const thumbnailUrl = resolveBannerAsset(
    row.thumbnail_key,
    row.thumbnail_url,
    row.updated_at
  );

  // The full-res render is produced at exactly the document's pixel
  // dimensions, so these two describe `url` truthfully. The thumbnail's size is
  // NOT derivable (two generators plus legacy keys, e.g. a 1080x1350 document
  // yielded a 399x499 thumbnail), which is why there is no fallback here and
  // no reported size for `thumbnailUrl`.
  const docWidth = toFiniteNumber(row.template?.width);
  const docHeight = toFiniteNumber(row.template?.height);

  const previewStatus = normalizePreviewStatus(row.preview_status);
  const documentRevision = toFiniteNumber(row.document_revision);
  const previewRevision = toFiniteNumber(row.preview_revision);

  // `stale` warns that the rendered image is behind the saved document. It
  // tracks ANY render, thumbnail included — a thumbnail-only design can still
  // be out of date — so it is not keyed off `url`, which is now full-res only.
  // With nothing rendered at all there is nothing to be stale about. Rows
  // predating revision tracking carry null on both sides: equal-and-absent
  // counts as current, while a document revision without a matching preview
  // revision is a real mismatch.
  const hasRender = Boolean(url || thumbnailUrl);
  const stale = hasRender
    ? previewStatus !== "ready" || documentRevision !== previewRevision
    : false;

  const { episode, variant } = parseRefDesignName(row.name);

  return {
    id: row.id,
    name: row.name ?? "",
    episode,
    variant,
    aspect: formatAspectRatio(docWidth, docHeight),
    width: url ? docWidth : null,
    height: url ? docHeight : null,
    docWidth,
    docHeight,
    url,
    urlKind: url ? "full" : null,
    thumbnailUrl,
    refUrl: `${siteUrl}/ref/${row.id}`,
    editUrl: `${siteUrl}/edit/${row.id}`,
    updatedAt: row.updated_at,
    previewStatus,
    stale,
  };
}

function requireAdminClient() {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error(
      "Ref Library requires the service-role Supabase client. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return supabase;
}

const mapRows = (data: unknown[] | null): RefDesign[] =>
  (data ?? []).map((row) => mapRowToRefDesign(row as RefDesignRow));

let ownerIdsPromise: Promise<string[]> | null = null;

function parseOwnerIdsEnv(): string[] {
  return (process.env.REF_OWNER_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

async function loadOwnerIds(): Promise<string[]> {
  const fromEnv = parseOwnerIdsEnv();
  if (fromEnv.length > 0) return fromEnv;

  // No explicit allowlist: expose the admin accounts' designs. profiles.id is
  // the primary key and matches banners.user_id.
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (error) {
    throw new Error(`Failed to resolve ref owner ids: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => (row as { id: string | null }).id)
    .filter((id): id is string => Boolean(id));
}

// Cached per process: the owner set changes about never, and both the HTTP API
// and the MCP endpoint hit it on every request.
export function getRefOwnerIds(): Promise<string[]> {
  if (!ownerIdsPromise) {
    ownerIdsPromise = loadOwnerIds().catch((error) => {
      // Do not cache failures, otherwise a transient DB error would disable the
      // whole Ref Library for the lifetime of the process.
      ownerIdsPromise = null;
      throw error;
    });
  }
  return ownerIdsPromise;
}

export interface ListRefDesignsOptions {
  search?: string;
  limit?: number;
  offset?: number;
  /** Only designs that have a full-resolution render (`url` non-null). */
  renderedOnly?: boolean;
  /** Only designs whose rendered width is at least this. Implies renderedOnly. */
  minWidth?: number;
}

export interface ListRefDesignsResult {
  /** The requested window. */
  designs: RefDesign[];
  /** Designs matching the filters, ignoring limit/offset. */
  total: number;
}

export interface RefDesignsByIdsResult {
  designs: RefDesign[];
  missing: string[];
}

/**
 * OWNER-SCOPED. The enumeration path: browse and search the ref owners'
 * designs only. Anything outside REF_OWNER_USER_IDS (or, unset, the admin
 * accounts) is invisible here, because a listing that spanned every account
 * would let one request harvest the ids that `getRefDesignsByIds` treats as
 * access capabilities.
 *
 * `total` is the size of the whole match set, so a caller can tell "there are
 * exactly this many" from "your limit truncated the result" — which
 * `designs.length` alone never could.
 */
export async function listRefDesigns(
  options: ListRefDesignsOptions = {}
): Promise<ListRefDesignsResult> {
  const ownerIds = await getRefOwnerIds();
  if (ownerIds.length === 0) return { designs: [], total: 0 };

  const supabase = requireAdminClient();
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);
  const minWidth = normalizeMinWidth(options.minWidth);
  // An unrendered design has no width at all, so a minWidth request can only
  // ever be satisfied by a rendered one.
  const renderedOnly = options.renderedOnly === true || minWidth !== null;

  // Everything that Postgres can decide is decided in Postgres. `updated_at`
  // has ties, so id breaks them: without a total order, offset paging would
  // drop and repeat rows across pages.
  const buildQuery = (selectOptions?: {
    count?: "exact";
    head?: boolean;
  }) => {
    let query = supabase
      .from("banners")
      .select(REF_DESIGN_COLUMNS, selectOptions)
      .in("user_id", ownerIds);

    if (options.search) query = query.ilike("name", `%${options.search}%`);
    if (renderedOnly) query = query.or(HAS_FULLRES_FILTER);

    return query
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false });
  };

  if (minWidth === null) {
    const { data, error, count } = await buildQuery({ count: "exact" }).range(
      offset,
      offset + limit - 1
    );

    if (error) {
      // PostgREST answers 416 when the window starts past the last row. That
      // is an empty page, not a failure — a caller paging on a `total` that
      // has since shrunk must not get a 500. postgrest-js only reads the row
      // count off a successful response, so it takes a second, rows-free query
      // to report `total` here; this path is rare enough to pay for it.
      if (error.code === RANGE_NOT_SATISFIABLE) {
        const { count: totalCount, error: countError } = await buildQuery({
          count: "exact",
          head: true,
        });
        if (countError) {
          throw new Error(`Failed to list ref designs: ${countError.message}`);
        }
        return { designs: [], total: totalCount ?? 0 };
      }

      throw new Error(`Failed to list ref designs: ${error.message}`);
    }

    const designs = mapRows(data);
    return { designs, total: count ?? designs.length };
  }

  // minWidth lives inside the `template` jsonb, and PostgREST compares
  // `template->>width` as TEXT — "900" >= "2000" is true lexicographically — so
  // expressing it as a query filter would silently return wrong rows. It is
  // filtered in JS instead, which means the query must fetch the whole
  // rendered match set first and apply limit/offset afterwards. `total` is then
  // the real post-filter count and the window is exact, at the cost of one
  // wide read; MAX_SCAN_ROWS bounds it (Supabase caps a response at 1000 rows
  // anyway, and the owner set is a few hundred designs).
  const { data, error } = await buildQuery(undefined).limit(MAX_SCAN_ROWS);
  if (error) {
    throw new Error(`Failed to list ref designs: ${error.message}`);
  }

  const matched = mapRows(data).filter(
    (design) => design.width !== null && design.width >= minWidth
  );

  return {
    designs: matched.slice(offset, offset + limit),
    total: matched.length,
  };
}

// Pure. Names the shared ordering helper's result after this kind: designs come
// back in the caller's requested order, and every distinct requested id that did
// not resolve — unknown, not a uuid, or past MAX_LIMIT — lands in `missing`, so
// `designs.length + missing.length` accounts for each one exactly once.
export function orderByRequestedIds(
  designs: RefDesign[],
  requestedIds: string[]
): RefDesignsByIdsResult {
  const { items, missing } = orderRecordsByRequestedIds(designs, requestedIds);
  return { designs: items, missing };
}

/**
 * UNSCOPED, deliberately. Resolves designs by exact id for any owner: the id is
 * the access capability (see the trust model at the top of this file), so a
 * caller holding one gets the design whether or not the account behind it is a
 * ref owner. There is no owner filter to add back without breaking the shared
 * /ref/{id} URLs users copy from /mydesign.
 *
 * Ids come back in the caller's requested order; unresolved ones in `missing`.
 */
export async function getRefDesignsByIds(
  ids: string[]
): Promise<RefDesignsByIdsResult> {
  const lookupIds = selectLookupIds(ids);
  if (lookupIds.length === 0) {
    return orderByRequestedIds([], ids);
  }

  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("banners")
    .select(REF_DESIGN_COLUMNS)
    .in("id", lookupIds)
    .limit(lookupIds.length);

  if (error) {
    throw new Error(`Failed to load ref designs by id: ${error.message}`);
  }

  return orderByRequestedIds(mapRows(data), ids);
}

// Unscoped by way of getRefDesignsByIds: knowing the id is enough.
export async function getRefDesign(id: string): Promise<RefDesign | null> {
  const { designs } = await getRefDesignsByIds([id]);
  return designs[0] ?? null;
}

// ---------------------------------------------------------------------------
// DESIGN LAYERS (phase 1 of 3)
//
// `url` hands a consumer ONE FLATTENED JPEG, which is all a still image needs
// but leaves an animation with nothing to animate: a Remotion composition can
// only pan and scale the whole picture. These functions expose the saved
// DOCUMENT STRUCTURE instead — the elements, in draw order, with their
// geometry — so a background, a character cutout and a caption can move
// independently.
//
// WHY THIS IS CHEAP TO GET RIGHT FOR IMAGES: an image element's `src` is an
// asset key pointing at the ORIGINAL uploaded file (a transparent-PNG cutout
// from `default-images/`, or a user's background from `user-images/`), already
// world-readable on R2. Handing over that URL plus the stored geometry does not
// approximate the layer, it IS the layer — no re-rendering step exists to get
// wrong. Only text is approximate, because the editor lays it out with Konva
// and a DOM/Remotion renderer measures glyphs differently. `exact` says which
// is which per layer, and `fidelity` says it once for the whole design.
//
// 🔴 ACCESS SCOPE: unscoped by id, exactly like getRefDesignsByIds — the uuid
// is the capability. Note what that now unlocks: this is DOCUMENT STRUCTURE,
// i.e. the text strings and the source asset keys, and a source key is the
// ORIGINAL UPLOAD AT FULL RESOLUTION rather than the flattened render. That is
// strictly MORE than an id used to unlock. The owner has explicitly decided not
// to gate it yet, and it is accepted for now because ENUMERATION STAYS
// OWNER-SCOPED (listRefDesigns), so a stranger has no way to discover an id
// through this API. Revisiting it is a recorded task — see the "Access scope
// for document structure" item under 今後 in docs/REF_LIBRARY.md, which also
// notes that /api/video-factory/banners gates the same `elements` column
// behind admin auth, so the two paths now disagree deliberately.
// ---------------------------------------------------------------------------

/** One element of a saved design, ready to be placed by an external renderer. */
export interface RefDesignLayer {
  index: number; // 0 = bottom, ascending = drawn on top
  type: "image" | "text" | "shape";
  // Geometry, in canvas pixels, top-left origin — as stored.
  x: number;
  y: number;
  width: number | null; // null for text (Konva measures it)
  height: number | null;
  rotation: number; // degrees, 0 when unset
  opacity: number; // 1 when unset
  // Exactly reproducible by placing this layer as described?
  exact: boolean;
  // type: "image"
  url?: string; // resolved public URL of the source file
  // type: "text"
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  align?: string;
  // Paint, shared by text and shape layers: both store the same five fields,
  // and a shape without them could not be drawn at all.
  fill?: string;
  fillEnabled?: boolean;
  stroke?: string;
  strokeWidth?: number;
  strokeEnabled?: boolean;
  // type: "shape"
  shapeType?: string;
}

export interface RefDesignLayers {
  id: string;
  name: string;
  width: number | null; // canvas size
  height: number | null;
  backgroundColor: string; // the design's canvas_color
  layers: RefDesignLayer[];
  // Machine-readable statement of what reproduces exactly.
  fidelity: {
    images: "exact";
    text: "approximate" | "none"; // "none" when the design has no text
    note: string;
  };
}

// Columns this path selects from public.banners. Deliberately a SEPARATE query
// from REF_DESIGN_COLUMNS rather than a widening of it: `elements` is the
// largest column on the table and the listing returns up to 200 rows, so
// carrying it there to serve one lookup would make every listing pay for it.
const REF_DESIGN_LAYER_COLUMNS = "id, name, template, canvas_color, elements";

// Shape of those columns. `template` repeats RefDesignRow's two dimensions and
// nothing else, since the canvas colour is read from its own column.
export interface RefDesignLayersRow {
  id: string;
  name: string | null;
  template: { width?: number | null; height?: number | null } | null;
  canvas_color: string | null;
  elements: unknown[] | null;
}

const FIDELITY_NOTE_WITH_TEXT =
  "Image layers are the original source files, so placing each one at the geometry given here reproduces the flattened render exactly. " +
  "Text layers are laid out by the editor's canvas engine (Konva), so a DOM-based renderer such as Remotion will differ slightly in letter spacing and wrapping — phase 2 will supply a pre-rendered transparent PNG for text.";

const FIDELITY_NOTE_IMAGES_ONLY =
  "Image layers are the original source files, so placing each one at the geometry given here reproduces the flattened render exactly. " +
  "This design has no text, so nothing in it is approximate.";

// The editor's own default when a document carries no canvas colour. Every row
// in public.banners currently has one, so this is a guard, not a code path.
const DEFAULT_CANVAS_COLOR = "#ffffff";

/**
 * Pure. Maps one stored element to a layer.
 *
 * `element` is typed as CanvasElement for readability, but it arrives from an
 * UNVALIDATED jsonb column, so every field is read defensively even where the
 * type declares it required — a row written by an older editor build may be
 * missing anything.
 */
export function mapElementToRefLayer(
  element: CanvasElement,
  index: number
): RefDesignLayer {
  const base = {
    index,
    x: toFiniteNumber(element.x) ?? 0,
    y: toFiniteNumber(element.y) ?? 0,
    rotation: toFiniteNumber(element.rotation) ?? 0,
    opacity: toFiniteNumber(element.opacity) ?? 1,
  };

  if (element.type === "text") {
    return {
      ...base,
      type: "text",
      // Konva measures a text box from its content, so the document stores no
      // size for it. Reporting a guess here is what `exact: false` exists to
      // avoid.
      width: null,
      height: null,
      exact: false,
      text: element.text ?? "",
      fontFamily: element.fontFamily,
      fontSize: toFiniteNumber(element.fontSize) ?? undefined,
      fontWeight: toFiniteNumber(element.fontWeight) ?? undefined,
      letterSpacing: toFiniteNumber(element.letterSpacing) ?? undefined,
      lineHeight: toFiniteNumber(element.lineHeight) ?? undefined,
      align: element.align,
      fill: element.fill,
      fillEnabled: element.fillEnabled,
      stroke: element.stroke,
      strokeWidth: toFiniteNumber(element.strokeWidth) ?? undefined,
      strokeEnabled: element.strokeEnabled,
    };
  }

  if (element.type === "shape") {
    return {
      ...base,
      type: "shape",
      width: toFiniteNumber(element.width),
      height: toFiniteNumber(element.height),
      exact: true,
      shapeType: element.shapeType,
      fill: element.fill,
      fillEnabled: element.fillEnabled,
      stroke: element.stroke,
      strokeWidth: toFiniteNumber(element.strokeWidth) ?? undefined,
      strokeEnabled: element.strokeEnabled,
    };
  }

  return {
    ...base,
    type: "image",
    width: toFiniteNumber(element.width),
    height: toFiniteNumber(element.height),
    exact: true,
    // resolveElementSrc, byte for byte what the editor's ImageRenderer loads,
    // so a layer URL and the canvas both hit the same cached R2 object.
    url: resolveElementSrc(element.src),
  };
}

/**
 * Pure row -> RefDesignLayers mapping, kept free of Supabase so it can be unit
 * tested directly (same factoring as mapRowToRefDesign).
 *
 * 🔴 ELEMENTS WITH `visible: false` ARE OMITTED. They are not in the flattened
 * render either, so a consumer that draws everything it is handed lands on the
 * same picture as `url` — which is the whole promise of this payload. `index`
 * is therefore renumbered over what survives, leaving no gaps to interpret.
 */
export function mapRowToRefDesignLayers(
  row: RefDesignLayersRow
): RefDesignLayers {
  const stored = Array.isArray(row.elements)
    ? (row.elements as CanvasElement[])
    : [];

  const layers = stored
    .filter((element) => Boolean(element) && element.visible !== false)
    .map((element, index) => mapElementToRefLayer(element, index));

  const hasText = layers.some((layer) => layer.type === "text");

  return {
    id: row.id,
    name: row.name ?? "",
    width: toFiniteNumber(row.template?.width),
    height: toFiniteNumber(row.template?.height),
    backgroundColor: row.canvas_color ?? DEFAULT_CANVAS_COLOR,
    layers,
    fidelity: {
      images: "exact",
      text: hasText ? "approximate" : "none",
      note: hasText ? FIDELITY_NOTE_WITH_TEXT : FIDELITY_NOTE_IMAGES_ONLY,
    },
  };
}

/**
 * UNSCOPED by id, like getRefDesignsByIds — see the access-scope note in this
 * section's header for what that exposes and why it is accepted for now.
 *
 * Returns null for an unknown id and for anything that is not a uuid (which can
 * never match a row id and must not reach the query).
 */
export async function getRefDesignLayers(
  id: string
): Promise<RefDesignLayers | null> {
  const lookupId = normalizeId(id);
  if (!isUuid(lookupId)) return null;

  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("banners")
    .select(REF_DESIGN_LAYER_COLUMNS)
    .eq("id", lookupId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ref design layers: ${error.message}`);
  }
  if (!data) return null;

  return mapRowToRefDesignLayers(data as unknown as RefDesignLayersRow);
}
