import "server-only";

// Shared primitives for the Ref Library resolvers (designs.ts, assets.ts).
//
// Only KIND-AGNOSTIC, PURE pieces live here: site origin, id hygiene, window
// clamping, aspect ratio, the `fields` projection machinery, and the query
// guard both /ref image aliases share. Anything that
// encodes a kind's security posture — which rows a listing may see, which
// Supabase credential the queries run under — deliberately stays in the
// per-kind module, so no one can widen a scope by editing a file that looks
// like generic plumbing. See the trust-model headers in designs.ts (id as
// capability, owner-scoped enumeration) and assets.ts (public curated data).

const DEFAULT_SITE_URL = "https://whatif-ep.xyz";

// Window defaults shared by every Ref Library listing, and the cap on how many
// ids one id-lookup request may resolve.
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

// `/ref/{id}.jpg` must behave like `/ref/{id}`: some consumers (social
// scrapers, video pipelines, image loaders) decide how to treat a URL from its
// file extension, so the aliases accept a cosmetic image suffix.
export function stripImageExtension(value: string): string {
  return value.replace(/\.(jpe?g|png)$/i, "");
}

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

// Postgres hands back bigints as strings, so a numeric column cannot be trusted
// to arrive as a number.
export const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

const greatestCommonDivisor = (a: number, b: number): number =>
  b === 0 ? a : greatestCommonDivisor(b, a % b);

/**
 * Pure. Formats a reduced aspect ratio ("4:5", "16:9", "9:16", "1:1") from a
 * pair of dimensions. Each kind decides which pair to feed it: designs use the
 * DOCUMENT dimensions so the ratio is known even for a design that has never
 * been rendered, library assets use the recorded pixel size of the file.
 */
export function formatAspectRatio(
  width: number | null,
  height: number | null
): string | null {
  if (width === null || height === null) return null;

  const w = Math.round(width);
  const h = Math.round(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }

  const divisor = greatestCommonDivisor(w, h);
  return `${w / divisor}:${h / divisor}`;
}

export const clampLimit = (limit: number | undefined): number => {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};

export const clampOffset = (offset: number | undefined): number => {
  if (typeof offset !== "number" || !Number.isFinite(offset)) return 0;
  return Math.max(Math.trunc(offset), 0);
};

export const normalizeMinWidth = (
  minWidth: number | undefined
): number | null => {
  if (typeof minWidth !== "number" || !Number.isFinite(minWidth)) return null;
  const value = Math.trunc(minWidth);
  return value > 0 ? value : null;
};

// Postgres stores uuids canonically lower-cased, so a caller's mixed-case id
// must be folded before it is compared against a returned row id.
export const normalizeId = (value: string): string => value.trim().toLowerCase();

// Pure. Narrows a caller's raw id list down to what is worth sending to
// Postgres: non-uuid entries can never match a row id (and must not reach an
// `in` filter), duplicates would waste a slot, and MAX_LIMIT bounds how much one
// request may resolve. Everything dropped here resurfaces as `missing`.
export function selectLookupIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const lookupIds: string[] = [];

  for (const raw of ids) {
    const id = normalizeId(raw);
    if (!isUuid(id) || seen.has(id)) continue;
    seen.add(id);
    lookupIds.push(id);
    if (lookupIds.length >= MAX_LIMIT) break;
  }

  return lookupIds;
}

export interface OrderedByRequestedIds<T> {
  items: T[];
  missing: string[];
}

// Pure. Puts fetched records back into the order the caller asked for and
// reports every distinct requested id that did not resolve — unknown, not a
// uuid, or past MAX_LIMIT — so `items.length + missing.length` accounts for
// each one exactly once. Each kind wraps this to name `items` after itself.
export function orderByRequestedIds<T extends { id: string }>(
  items: readonly T[],
  requestedIds: string[]
): OrderedByRequestedIds<T> {
  const byId = new Map(items.map((item) => [normalizeId(item.id), item]));
  const seen = new Set<string>();
  const ordered: T[] = [];
  const missing: string[] = [];

  for (const raw of requestedIds) {
    const id = normalizeId(raw);
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);

    const item = byId.get(id);
    if (item) ordered.push(item);
    else missing.push(id);
  }

  return { items: ordered, missing };
}

// The one field a projection can never drop. A record without its id cannot be
// looked up again, re-requested with other fields, or turned into a /ref/ URL,
// so it is projected whether or not the caller named it.
const ALWAYS_PROJECTED_FIELD = "id";

// Pure. Splits a caller's `fields` request into normalised, lower-cased names.
// BOTH shapes an API client naturally reaches for are accepted: the
// comma-separated string a query string can carry ("id,name"), and the array an
// LLM/MCP client tends to send for a multi-valued argument (["id","name"]),
// which used to be rejected outright with a schema error. An array entry may
// itself be comma-separated, since a client mixing the two forms is likelier
// than one that means a literal comma inside a field name.
export function parseRefFieldNames(
  raw: string | readonly string[] | null | undefined
): string[] {
  const parts = typeof raw === "string" ? [raw] : (raw ?? []);
  const names: string[] = [];

  for (const part of parts) {
    for (const name of part.split(",")) {
      const normalized = name.trim().toLowerCase();
      if (normalized.length > 0) names.push(normalized);
    }
  }

  return names;
}

// Pure. Resolves a caller's `fields` request into the field list to project:
//
//   absent/empty -> no request was made, so the caller's own default shape
//                   (`listFields`: the compact record for a listing, the full
//                   record where the wrapper passes that instead)
//   "all"        -> every field
//   named fields -> EXACTLY those fields, plus `id`
//
// That last line is a deliberate breaking change. `fields` used to ADD to the
// compact shape, so nothing could shrink a record: a consumer asking for
// "id,name,aspect,url" was still charged for docWidth, docHeight, urlKind and
// stale on every one of 200 records — ~17.5k tokens where ~6k was wanted, and
// no parameter existed to avoid it. `fields` now SELECTS rather than adds,
// which is the only way a caller can make a listing cheaper.
//
// Unknown names are ignored rather than rejected, so a client written against a
// later version of this API still gets a useful response. A request whose names
// are all unrecognised therefore projects `id` alone — honest (none of what it
// asked for exists here) and still never an error. The returned order is always
// the canonical one, never the caller's.
export function resolveRefFields<F extends string>(
  raw: string | readonly string[] | null | undefined,
  allFields: readonly F[],
  listFields: readonly F[]
): readonly F[] {
  const requested = parseRefFieldNames(raw);

  if (requested.length === 0) return listFields;
  if (requested.includes("all")) return allFields;

  const wanted = new Set<F>();
  const idField = allFields.find((field) => field === ALWAYS_PROJECTED_FIELD);
  if (idField) wanted.add(idField);

  for (const name of requested) {
    const match = allFields.find((field) => field.toLowerCase() === name);
    if (match) wanted.add(match);
  }

  return allFields.filter((field) => wanted.has(field));
}

// Query parameters that PROMISE AN IMAGE TRANSFORMATION, shared by both /ref
// image aliases (/ref/{id} and /ref/asset/{id}).
//
// This is an HONESTY GUARD, NOT A WHITELIST OF FEATURES. These endpoints serve
// the STORED image as-is: there is no resize or crop stage in front of R2, so
// every name listed here is something they cannot do, and a request carrying
// one is rejected rather than answered with the untouched image. A consumer
// that sent `?w=1920`, got a 302 and believed the resize had worked fed a
// 1200x630 render into a paid, per-call video generator, and only found out
// after paying for the render. Dynamic resizing stays deferred pending a cost
// decision (see docs/REF_LIBRARY.md), so until it exists these requests must
// fail loudly.
//
// Deliberately narrow: only names that promise a transformation. UNRELATED
// PARAMETERS MUST KEEP WORKING — cache-busters (`cb`, `v`), analytics
// (`utm_*`), whatever a crawler or a chat client appends to a pasted link —
// because these URLs are copied around by hand, and rejecting a harmless extra
// parameter would break ordinary links that never asked for anything.
export const REF_TRANSFORM_PARAMS = [
  "w",
  "h",
  "width",
  "height",
  "ar",
  "aspect",
  "fit",
  "crop",
  "dpr",
  "q",
  "quality",
  "format",
  "fm",
  "resize",
] as const;

const REF_TRANSFORM_PARAM_SET: ReadonlySet<string> = new Set(
  REF_TRANSFORM_PARAMS
);

/** Which stored image a /ref alias should serve. */
export type RefSize = "thumb" | "full";

const SERVES_AS_IS_MESSAGE =
  "This endpoint serves the stored image as-is. The only supported parameter is `size=thumb|full` (omit it for the full image). " +
  "Resizing and cropping are not supported, so resize on your own side. The `width`/`height` fields returned by /api/ref/designs, /api/ref/assets and the MCP tools tell you the source size.";

export type RefImageQuery =
  | { size: RefSize; error: null }
  | { size: null; error: string };

// Pure. Validates one /ref alias request's query string and reports which
// stored image to serve, or the message to answer 400 with.
//
// `size` accepts "thumb" and "full" and NOTHING ELSE. It used to mean thumb for
// the exact string "thumb" and, silently, full for every other value, so a
// typo ("small", "thumbnail") was answered with a full-resolution image the
// caller had not asked for. Parameter names and the `size` value are folded to
// lower case, so `?W=1920` and `?size=THUMB` behave like their canonical forms.
export function resolveRefImageQuery(params: URLSearchParams): RefImageQuery {
  const transforms: string[] = [];
  for (const key of params.keys()) {
    const name = key.trim().toLowerCase();
    if (REF_TRANSFORM_PARAM_SET.has(name) && !transforms.includes(name)) {
      transforms.push(name);
    }
  }

  if (transforms.length > 0) {
    const plural = transforms.length > 1 ? "s" : "";
    return {
      size: null,
      error: `Unsupported image transformation parameter${plural}: ${transforms.join(", ")}. ${SERVES_AS_IS_MESSAGE}`,
    };
  }

  const raw = params.get("size");
  if (raw === null) return { size: "full", error: null };

  const size = raw.trim().toLowerCase();
  if (size.length === 0 || size === "full") return { size: "full", error: null };
  if (size === "thumb") return { size: "thumb", error: null };

  return {
    size: null,
    error: `Unsupported \`size\` value "${raw}". ${SERVES_AS_IS_MESSAGE}`,
  };
}

// Pure. Narrows one record down to the requested fields, in the order given.
export function projectRefRecord<
  T extends object,
  F extends Extract<keyof T, string>,
>(record: T, fields: readonly F[]): Partial<T> {
  const projected: Record<string, unknown> = {};
  for (const field of fields) {
    projected[field] = record[field];
  }
  return projected as Partial<T>;
}
