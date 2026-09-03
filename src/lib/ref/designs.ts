import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAsset } from "@/lib/asset";

// Ref Library: exposes saved IMAGINE designs (public.banners) as public image
// references so external tools — MCP clients, curl/CLI, Remotion,
// video-generation APIs — can point at a rendered design by URL instead of
// re-exporting and re-uploading files by hand.
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

const DEFAULT_SITE_URL = "https://whatif-ep.xyz";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

// `/ref/{id}.jpg` must behave like `/ref/{id}`: some consumers (social
// scrapers, video pipelines, image loaders) decide how to treat a URL from its
// file extension, so the alias accepts a cosmetic image suffix.
export function stripImageExtension(value: string): string {
  return value.replace(/\.(jpe?g|png)$/i, "");
}

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

export interface RefDesign {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  url: string | null;
  urlKind: "full" | "thumb" | null;
  thumbnailUrl: string | null;
  refUrl: string;
  editUrl: string;
  updatedAt: string;
  previewStatus: "pending" | "ready" | "failed" | null;
  stale: boolean;
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

const PREVIEW_STATUSES = new Set(["pending", "ready", "failed"]);

const normalizePreviewStatus = (
  value: string | null
): RefDesign["previewStatus"] =>
  value && PREVIEW_STATUSES.has(value)
    ? (value as RefDesign["previewStatus"])
    : null;

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

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
  const fullUrl = resolveBannerAsset(
    row.fullres_key,
    row.fullres_url,
    row.updated_at
  );
  const thumbnailUrl = resolveBannerAsset(
    row.thumbnail_key,
    row.thumbnail_url,
    row.updated_at
  );

  // Prefer the full-res render; fall back to the thumbnail so a design that
  // only ever got a list preview is still usable as a reference.
  const url = fullUrl ?? thumbnailUrl;
  const urlKind: RefDesign["urlKind"] = fullUrl
    ? "full"
    : thumbnailUrl
      ? "thumb"
      : null;

  const previewStatus = normalizePreviewStatus(row.preview_status);
  const documentRevision = toFiniteNumber(row.document_revision);
  const previewRevision = toFiniteNumber(row.preview_revision);

  // `stale` warns that the rendered image is behind the saved document. With no
  // image at all there is nothing to be stale about, so it stays false and the
  // null `url` is the signal instead. Rows predating revision tracking carry
  // null on both sides: equal-and-absent counts as current, while a document
  // revision without a matching preview revision is a real mismatch.
  const stale = url
    ? previewStatus !== "ready" || documentRevision !== previewRevision
    : false;

  return {
    id: row.id,
    name: row.name ?? "",
    width: toFiniteNumber(row.template?.width),
    height: toFiniteNumber(row.template?.height),
    url,
    urlKind,
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
}

export interface RefDesignsByIdsResult {
  designs: RefDesign[];
  missing: string[];
}

const clampLimit = (limit: number | undefined): number => {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};

// Postgres stores uuids canonically lower-cased, so a caller's mixed-case id
// must be folded before it is compared against a returned row id.
const normalizeId = (value: string): string => value.trim().toLowerCase();

/**
 * OWNER-SCOPED. The enumeration path: browse and search the ref owners'
 * designs only. Anything outside REF_OWNER_USER_IDS (or, unset, the admin
 * accounts) is invisible here, because a listing that spanned every account
 * would let one request harvest the ids that `getRefDesignsByIds` treats as
 * access capabilities.
 */
export async function listRefDesigns(
  options: ListRefDesignsOptions = {}
): Promise<RefDesign[]> {
  const ownerIds = await getRefOwnerIds();
  if (ownerIds.length === 0) return [];

  const supabase = requireAdminClient();

  let query = supabase
    .from("banners")
    .select(REF_DESIGN_COLUMNS)
    .in("user_id", ownerIds)
    .order("updated_at", { ascending: false })
    .limit(clampLimit(options.limit));

  if (options.search) query = query.ilike("name", `%${options.search}%`);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list ref designs: ${error.message}`);
  }

  return mapRows(data);
}

// Pure. Narrows a caller's raw id list down to what is worth sending to
// Postgres: non-uuid entries can never match a banner id (and must not reach an
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

// Pure. Puts the fetched designs back into the order the caller asked for and
// reports every distinct requested id that did not resolve — unknown, not a
// uuid, or past MAX_LIMIT — so `designs.length + missing.length` accounts for
// each one exactly once.
export function orderByRequestedIds(
  designs: RefDesign[],
  requestedIds: string[]
): RefDesignsByIdsResult {
  const byId = new Map(designs.map((design) => [normalizeId(design.id), design]));
  const seen = new Set<string>();
  const ordered: RefDesign[] = [];
  const missing: string[] = [];

  for (const raw of requestedIds) {
    const id = normalizeId(raw);
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);

    const design = byId.get(id);
    if (design) ordered.push(design);
    else missing.push(id);
  }

  return { designs: ordered, missing };
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
