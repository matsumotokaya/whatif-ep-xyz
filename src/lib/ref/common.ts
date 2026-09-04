import "server-only";

// Shared primitives for the Ref Library resolvers (designs.ts, assets.ts).
//
// Only KIND-AGNOSTIC, PURE pieces live here: site origin, id hygiene, window
// clamping, aspect ratio, and the `fields` projection machinery. Anything that
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

// Pure. Resolves a caller's `fields` request into the field list to project.
// Empty/absent -> the compact list shape; "all" -> every field; otherwise the
// list shape PLUS whatever recognised names were asked for. Unknown names are
// ignored rather than rejected, so a client written against a later version of
// this API still gets a useful response. The returned order is always the
// canonical one, never the caller's.
export function resolveRefFields<F extends string>(
  raw: string | null | undefined,
  allFields: readonly F[],
  listFields: readonly F[]
): readonly F[] {
  const requested = (raw ?? "")
    .split(",")
    .map((field) => field.trim().toLowerCase())
    .filter((field) => field.length > 0);

  if (requested.length === 0) return listFields;
  if (requested.includes("all")) return allFields;

  const wanted = new Set<F>(listFields);
  for (const name of requested) {
    const match = allFields.find((field) => field.toLowerCase() === name);
    if (match) wanted.add(match);
  }

  return allFields.filter((field) => wanted.has(field));
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
