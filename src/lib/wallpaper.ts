import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  status: string | null;
}

// Build a public Storage URL for a public bucket object.
function buildPublicUrl(bucket: string, storagePath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${baseUrl}/storage/v1/object/public/${bucket}/${storagePath.replace(/^\/+/, "")}`;
}

export async function getPublishedWallpaperPack(
  seriesSlug: string,
  displayCode: string,
  variantNumber = 1
): Promise<WallpaperPack | null> {
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
      "id, role, storage_bucket, storage_path, mime_type, width, height, status"
    )
    .eq("project_id", project.id)
    .eq("status", "ready");

  const outputs = (outputsData ?? []) as unknown as ProductionOutputRow[];

  const toOutput = (row: ProductionOutputRow): WallpaperOutput | null => {
    if (!row.storage_bucket || !row.storage_path) return null;
    return {
      id: row.id,
      role: row.role as WallpaperOutputRole,
      publicUrl: buildPublicUrl(row.storage_bucket, row.storage_path),
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
}
