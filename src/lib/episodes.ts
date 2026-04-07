import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Episode, EpisodeRow } from "./types";

const EPISODE_COLUMNS = [
  "id",
  "number",
  "title",
  "category",
  "product_url",
  "released_on",
  "original_storage_key",
  "thumbnail_storage_key",
  "is_published",
  "published_at",
  "created_at",
  "updated_at",
].join(", ");

function mapEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    category: row.category,
    hasOriginalPng: row.original_storage_key.toLowerCase().endsWith(".png"),
    hasThumbnailJpg: row.thumbnail_storage_key?.toLowerCase().endsWith(".jpg") ?? false,
    productUrl: row.product_url,
    createdAt: row.released_on ?? row.created_at.slice(0, 10),
    updatedAt: row.updated_at,
    originalStorageKey: row.original_storage_key,
    thumbnailStorageKey: row.thumbnail_storage_key,
    isPublished: row.is_published,
    publishedAt: row.published_at,
  };
}

const getVisibleEpisodes = cache(async (): Promise<Episode[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("episodes")
    .select(EPISODE_COLUMNS)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load episodes: ${error.message}`);
  }

  return ((data ?? []) as unknown as EpisodeRow[]).map(mapEpisode);
});

export async function getAllEpisodes(
  sort: "newest" | "oldest" = "newest"
): Promise<Episode[]> {
  const episodes = await getVisibleEpisodes();
  return sort === "newest" ? [...episodes].reverse() : episodes;
}

export async function getEpisodeByNumber(number: string): Promise<Episode | undefined> {
  const episodes = await getVisibleEpisodes();
  return episodes.find((episode) => episode.number === number);
}

export async function getAdjacentEpisodes(
  id: number
): Promise<{ prev: Episode | undefined; next: Episode | undefined }> {
  const episodes = await getVisibleEpisodes();
  const index = episodes.findIndex((episode) => episode.id === id);

  return {
    prev: index > 0 ? episodes[index - 1] : undefined,
    next: index >= 0 && index < episodes.length - 1 ? episodes[index + 1] : undefined,
  };
}

export async function getTotalCount(): Promise<number> {
  const episodes = await getVisibleEpisodes();
  return episodes.length;
}
