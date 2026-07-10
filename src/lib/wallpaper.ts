import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAssetUrl, r2AssetsKey } from "@/lib/asset-url";

// Roles that make up a wallpaper pack (excludes instagram_feed and zip).
export type WallpaperOutputRole =
  | "mobile_hd"
  | "mobile_qhd"
  | "pc_hd"
  | "pc_qhd"
  | "package_cover";

export interface WallpaperOutput {
  id: string;
  role: WallpaperOutputRole;
  publicUrl: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
}

export interface WallpaperPack {
  projectId: string;
  seriesSlug: string;
  displayCode: string;
  variantNumber: number;
  cover: WallpaperOutput | null;
  wallpapers: WallpaperOutput[];
}

// Human-readable labels for wallpaper sizes shown in the gallery UI.
export const WALLPAPER_ROLE_LABELS: Record<WallpaperOutputRole, string> = {
  mobile_hd: "Mobile HD · 1080×1920",
  mobile_qhd: "Mobile QHD · 1440×2560",
  pc_hd: "PC HD · 1920×1080",
  pc_qhd: "PC QHD · 2560×1440",
  package_cover: "Package Cover · 1600×1600",
};

// Display / sort order for the four downloadable wallpaper sizes.
const WALLPAPER_ROLE_ORDER: WallpaperOutputRole[] = [
  "mobile_hd",
  "mobile_qhd",
  "pc_hd",
  "pc_qhd",
];

interface ProductionProjectRow {
  id: string;
}

interface ProductionOutputRow {
  id: string;
  role: string;
  storage_provider: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  status: string | null;
}

// Build a public URL for a production output, honoring its storage provider.
// Migrated rows (storage_provider='r2') resolve to the R2 custom domain
// (assets.whatif-ep.xyz) via the 'r2-assets' provider; older rows still resolve
// to the Supabase public Storage endpoint. The R2 object key mirrors the legacy
// Supabase layout with the logical bucket name as the key prefix: `{bucket}/{path}`.
function buildPublicUrl(
  provider: string | null,
  bucket: string,
  storagePath: string
): string {
  if (provider === "r2") {
    return resolveAssetUrl("r2-assets", r2AssetsKey(bucket, storagePath));
  }
  return resolveAssetUrl("supabase", r2AssetsKey(bucket, storagePath));
}

// Feed, feed_thumb, and package_cover share the same published project set.
// Keep one combined cache/query so gallery and detail requests do not repeat
// the production_projects lookup once per output role.
interface SeriesProductionImageRecord {
  feed: Record<string, string>;
  feedThumb: Record<string, string>;
  cover: Record<string, string>;
}

const _cachedSeriesProductionImageRecord = unstable_cache(
  async (seriesSlug: string): Promise<SeriesProductionImageRecord> => {
    const supabase = createAdminClient();
    const empty: SeriesProductionImageRecord = {
      feed: {},
      feedThumb: {},
      cover: {},
    };
    if (!supabase) return empty;

    const { data: projectsData } = await supabase
      .from("production_projects")
      .select("id, work_display_code, variant_number")
      .eq("work_series_slug", seriesSlug)
      .eq("status", "published");
    const projects = (projectsData ?? []) as unknown as Array<{
      id: string;
      work_display_code: string;
      variant_number: number;
    }>;
    if (projects.length === 0) return empty;

    const { data: outputsData } = await supabase
      .from("production_outputs")
      .select("project_id, role, storage_provider, storage_bucket, storage_path")
      .in("project_id", projects.map((project) => project.id))
      .in("role", ["instagram_feed", "feed_thumb", "package_cover"])
      .eq("status", "ready");
    const outputs = (outputsData ?? []) as unknown as Array<{
      project_id: string;
      role: string;
      storage_provider: string | null;
      storage_bucket: string | null;
      storage_path: string | null;
    }>;

    const projectById = new Map(projects.map((project) => [project.id, project]));
    const record: SeriesProductionImageRecord = {
      feed: {},
      feedThumb: {},
      cover: {},
    };
    for (const output of outputs) {
      const project = projectById.get(output.project_id);
      if (!project || !output.storage_bucket || !output.storage_path) continue;
      const key = `${project.work_display_code}:${project.variant_number}`;
      const url = buildPublicUrl(
        output.storage_provider,
        output.storage_bucket,
        output.storage_path
      );
      if (output.role === "instagram_feed") record.feed[key] = url;
      if (output.role === "feed_thumb") record.feedThumb[key] = url;
      if (output.role === "package_cover") record.cover[key] = url;
    }
    return record;
  },
  ["production:series-image-maps"],
  { tags: ["production"], revalidate: 3600 }
);

// ─── Cached: feed image map for a series ─────────────────────────────────────
// Tags: ['production', 'production:<seriesSlug>']  revalidate: 3600s
//
// unstable_cache serializes via JSON.stringify, so Map is not safe to return.
// The cached helper returns a plain Record<string, string>; the public export
// wraps it in a Map so callers do not change.
//
// Uses createAdminClient (service-role, cookie-free) — required because
// production_* tables are not accessible to anon (admin-only per RLS).
// Map of "displayCode:variantNumber" -> public feed image URL for a series.
// Built from published production projects' ready instagram_feed outputs.
// Used by the gallery to show Content Factory feed images on work cards.
export async function getSeriesFeedImageMap(
  seriesSlug: string
): Promise<Map<string, string>> {
  const record = await _cachedSeriesProductionImageRecord(seriesSlug);
  return new Map(Object.entries(record.feed));
}

// ─── Cached: feed-thumb map for a series ─────────────────────────────────────
// Tags: ['production', 'production:<seriesSlug>']  revalidate: 3600s
//
// Same shape/keying as the feed-image map, but keyed to the lightweight
// 'feed_thumb' output (~720px long edge, WebP, credit preserved). The Gallery
// list grid prefers this and renders it `unoptimized` to bypass Vercel Image
// Optimization. Older works without a feed_thumb are simply absent from this
// map and fall back to the full feed image (still optimized via next/image).
// Map of "displayCode:variantNumber" -> public feed-thumb URL for a series.
// Built from published production projects' ready feed_thumb outputs.
export async function getSeriesFeedThumbMap(
  seriesSlug: string
): Promise<Map<string, string>> {
  const record = await _cachedSeriesProductionImageRecord(seriesSlug);
  return new Map(Object.entries(record.feedThumb));
}

// ─── Cached: wallpaper cover map for a series ────────────────────────────────
// Tags: ['production', 'production:<seriesSlug>']  revalidate: 3600s
//
// Same shape as the feed-image map, but keyed to the package_cover output —
// the image shown on the wallpaper sales page. Used by the detail page's
// "other wallpapers" strip to promote nearby packs by their cover.
// Map of "displayCode:variantNumber" -> public package_cover URL for a series.
export async function getSeriesWallpaperCoverMap(
  seriesSlug: string
): Promise<Map<string, string>> {
  const record = await _cachedSeriesProductionImageRecord(seriesSlug);
  return new Map(Object.entries(record.cover));
}

// ─── Cached: wallpaper pack for a specific work variant ──────────────────────
// Tags: ['production', 'production:<seriesSlug>']  revalidate: 3600s
const _cachedWallpaperPack = unstable_cache(
  async (
    seriesSlug: string,
    displayCode: string,
    variantNumber: number
  ): Promise<WallpaperPack | null> => {
    const supabase = createAdminClient();
    if (!supabase) return null;

    // Resolve the published production project for this work + variant.
    const { data: projectData } = await supabase
      .from("production_projects")
      .select("id")
      .eq("work_series_slug", seriesSlug)
      .eq("work_display_code", displayCode)
      .eq("variant_number", variantNumber)
      .eq("status", "published")
      .maybeSingle();

    const project = projectData as ProductionProjectRow | null;
    if (!project) return null;

    // Load all ready outputs for the project.
    const { data: outputsData } = await supabase
      .from("production_outputs")
      .select(
        "id, role, storage_provider, storage_bucket, storage_path, mime_type, width, height, status"
      )
      .eq("project_id", project.id)
      .eq("status", "ready");

    const outputs = (outputsData ?? []) as unknown as ProductionOutputRow[];

    const toOutput = (row: ProductionOutputRow): WallpaperOutput | null => {
      if (!row.storage_bucket || !row.storage_path) return null;
      return {
        id: row.id,
        role: row.role as WallpaperOutputRole,
        publicUrl: buildPublicUrl(row.storage_provider, row.storage_bucket, row.storage_path),
        width: row.width,
        height: row.height,
        mimeType: row.mime_type,
      };
    };

    const coverRow = outputs.find((row) => row.role === "package_cover");
    const cover = coverRow ? toOutput(coverRow) : null;

    // Keep only the four wallpaper sizes, ordered as defined above.
    const wallpapers = WALLPAPER_ROLE_ORDER.map((role) => {
      const row = outputs.find((item) => item.role === role);
      return row ? toOutput(row) : null;
    }).filter((output): output is WallpaperOutput => output !== null);

    return {
      projectId: project.id,
      seriesSlug,
      displayCode,
      variantNumber,
      cover,
      wallpapers,
    };
  },
  // keyParts prefix — actual cache key includes seriesSlug, displayCode, variantNumber args
  ["production:wallpaper-pack"],
  { tags: ["production"], revalidate: 3600 }
);

export async function getPublishedWallpaperPack(
  seriesSlug: string,
  displayCode: string,
  variantNumber = 1
): Promise<WallpaperPack | null> {
  return _cachedWallpaperPack(seriesSlug, displayCode, variantNumber);
}
