import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAsset } from "@/lib/asset";

// Ref Library (v1): exposes the owner's saved IMAGINE designs (public.banners)
// as public image references so external tools — MCP clients, curl/CLI,
// Remotion, video-generation APIs — can point at a rendered design by URL
// instead of re-exporting and re-uploading files by hand.
//
// Only designs owned by the configured "ref owner" accounts are ever exposed.
// The owner has more than one account, so the set is configurable through
// REF_OWNER_USER_IDS and falls back to profiles.role = 'admin'.
//
// Rendered previews live in R2 under immutable, revisioned keys
// (user-images/{uid}/banners/{bannerId}/full/{revision}.jpg) and are
// world-readable with permissive CORS, so the resolved URLs can be handed
// straight to any consumer.

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
  ids?: string[];
}

export interface ListRefDesignsResult {
  designs: RefDesign[];
  missing: string[];
}

const clampLimit = (limit: number | undefined): number => {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};

export async function listRefDesigns(
  options: ListRefDesignsOptions = {}
): Promise<ListRefDesignsResult> {
  const { search, ids } = options;
  const ownerIds = await getRefOwnerIds();
  if (ownerIds.length === 0) {
    return { designs: [], missing: ids ?? [] };
  }

  const requestedIds = ids?.filter((id) => id.length > 0);
  const supabase = requireAdminClient();

  let query = supabase
    .from("banners")
    .select(REF_DESIGN_COLUMNS)
    // Owner scoping is applied for every query shape, id lookups included, so
    // a foreign banner id can never be read through this API.
    .in("user_id", ownerIds)
    .order("updated_at", { ascending: false })
    .limit(requestedIds ? Math.min(requestedIds.length, MAX_LIMIT) : clampLimit(options.limit));

  if (requestedIds) query = query.in("id", requestedIds);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list ref designs: ${error.message}`);
  }

  const designs = (data ?? []).map((row) =>
    mapRowToRefDesign(row as unknown as RefDesignRow)
  );

  if (!requestedIds) {
    return { designs, missing: [] };
  }

  // Preserve the caller's id order and report what could not be resolved.
  const byId = new Map(designs.map((design) => [design.id, design]));
  const ordered: RefDesign[] = [];
  const missing: string[] = [];
  for (const id of requestedIds) {
    const design = byId.get(id);
    if (design) ordered.push(design);
    else missing.push(id);
  }

  return { designs: ordered, missing };
}

export async function getRefDesign(id: string): Promise<RefDesign | null> {
  if (!isUuid(id)) return null;
  const { designs } = await listRefDesigns({ ids: [id] });
  return designs[0] ?? null;
}
