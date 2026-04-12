import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClubItemKind = "wallpaper" | "zip" | "reel" | "other" | "book";

export type ClubItemStatus = "preview" | "coming-soon";

export interface ClubItem {
  slug: string;
  title: string;
  kind: ClubItemKind;
  status: ClubItemStatus;
  description: string;
  details: string[];
  coverImageUrl: string | null;
  fileName: string;
  fileSizeLabel: string;
  updatedAt: string;
  accent: "cyan" | "magenta" | "green";
  tags: string[];
}

export interface ClubStats {
  total: number;
  wallpapers: number;
  ready: number;
}

type ClubItemRecord = {
  slug: string;
  title: string;
  description: string | null;
  kind: ClubItemKind;
  cover_image_url: string | null;
  storage_key: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  is_published: boolean;
  published_at: string | null;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const value =
    size >= 10 || idx === 0 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${value} ${units[idx]}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function buildCoverUrl(storageKey: string | null) {
  if (!storageKey) return null;
  const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL;
  if (!baseUrl) return null;
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(storageKey, base).toString();
}

function resolveAccent(kind: ClubItemKind): ClubItem["accent"] {
  switch (kind) {
    case "wallpaper":
      return "cyan";
    case "reel":
      return "magenta";
    case "book":
    case "other":
      return "green";
    case "zip":
    default:
      return "magenta";
  }
}

function resolveDetails(kind: ClubItemKind) {
  switch (kind) {
    case "wallpaper":
      return ["HD + QHD included", "Optimized for 9:16 screens"];
    case "reel":
      return ["Premium archive package", "Includes original assets"];
    case "book":
      return ["Premium download", "Designed for reading offline"];
    case "zip":
      return ["Premium download", "Compressed archive"];
    default:
      return ["Premium download"];
  }
}

function resolveTags(kind: ClubItemKind) {
  const tags = new Set<string>(["premium", kind]);
  return Array.from(tags);
}

function mapRecord(record: ClubItemRecord): ClubItem {
  const status: ClubItemStatus = record.is_published ? "preview" : "coming-soon";
  const updatedAt =
    formatDate(record.updated_at) ||
    formatDate(record.published_at) ||
    formatDate(record.created_at);

  return {
    slug: record.slug,
    title: record.title,
    kind: record.kind,
    status,
    description: record.description ?? "",
    details: resolveDetails(record.kind),
    coverImageUrl: buildCoverUrl(record.cover_image_url),
    fileName: record.file_name,
    fileSizeLabel: formatFileSize(record.file_size_bytes),
    updatedAt,
    accent: resolveAccent(record.kind),
    tags: resolveTags(record.kind),
  };
}

export async function getClubItems(): Promise<ClubItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_items")
    .select(
      "slug,title,description,kind,cover_image_url,storage_key,file_name,file_size_bytes,mime_type,is_published,published_at,sort_order,created_at,updated_at"
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as ClubItemRecord[]).map(mapRecord);
}

export async function getClubItem(slug: string): Promise<ClubItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_items")
    .select(
      "slug,title,description,kind,cover_image_url,storage_key,file_name,file_size_bytes,mime_type,is_published,published_at,sort_order,created_at,updated_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data || !data.is_published) {
    return null;
  }

  return mapRecord(data as ClubItemRecord);
}

export async function getClubStats() {
  const admin = createAdminClient();
  if (admin) {
    const [totalResult, wallpaperResult] = await Promise.all([
      admin
        .from("club_items")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true),
      admin
        .from("club_items")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true)
        .eq("kind", "wallpaper"),
    ]);

    if (!totalResult.error && !wallpaperResult.error) {
      const total = totalResult.count ?? 0;
      const wallpapers = wallpaperResult.count ?? 0;
      return {
        total,
        wallpapers,
        ready: total,
      };
    }
  }

  const items = await getClubItems();
  if (items.length > 0) {
    const total = items.length;
    const wallpapers = items.filter((item) => item.kind === "wallpaper").length;
    const ready = items.filter((item) => item.status === "preview").length;

    return {
      total,
      wallpapers,
      ready,
    };
  }

  const seedStats = await getClubStatsFromSeedSql();
  if (seedStats) {
    return seedStats;
  }

  return {
    total: 0,
    wallpapers: 0,
    ready: 0,
  };
}

const getClubStatsFromSeedSql = cache(async (): Promise<ClubStats | null> => {
  try {
    const sqlPath = path.join(process.cwd(), "data", "club-items-upsert.sql");
    const sql = await readFile(sqlPath, "utf8");
    const blocks = sql.split(/insert into public\.club_items\s*\(/i).slice(1);

    let total = 0;
    let wallpapers = 0;

    for (const block of blocks) {
      const valuesBlock = block.split("on conflict")[0];
      const isPublished = /,\s*true,\s*[\r\n]+\s*timezone\(/m.test(valuesBlock);
      if (!isPublished) continue;
      total += 1;

      const isWallpaper = /[\r\n]\s*'wallpaper',\s*[\r\n]/m.test(valuesBlock);
      if (isWallpaper) wallpapers += 1;
    }

    if (total === 0) return null;
    return { total, wallpapers, ready: total };
  } catch {
    return null;
  }
});
