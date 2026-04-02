import episodesData from "@/data/episodes.json";
import type { Episode, EpisodesData } from "./types";

const data = episodesData as EpisodesData;

export function getAllEpisodes(sort: "newest" | "oldest" = "newest"): Episode[] {
  const episodes = [...data.episodes];
  if (sort === "newest") {
    episodes.sort((a, b) => b.id - a.id);
  } else {
    episodes.sort((a, b) => a.id - b.id);
  }
  return episodes;
}

export function getEpisodesByPage(
  page: number,
  perPage: number = 20,
  sort: "newest" | "oldest" = "newest"
): { episodes: Episode[]; hasMore: boolean; total: number } {
  const all = getAllEpisodes(sort);
  const start = (page - 1) * perPage;
  const episodes = all.slice(start, start + perPage);
  return {
    episodes,
    hasMore: start + perPage < all.length,
    total: all.length,
  };
}

export function getEpisodeByNumber(number: string): Episode | undefined {
  return data.episodes.find((ep) => ep.number === number);
}

export function getEpisodeById(id: number): Episode | undefined {
  return data.episodes.find((ep) => ep.id === id);
}

export function getAdjacentEpisodes(id: number): {
  prev: Episode | undefined;
  next: Episode | undefined;
} {
  const sorted = getAllEpisodes("oldest");
  const index = sorted.findIndex((ep) => ep.id === id);
  return {
    prev: index > 0 ? sorted[index - 1] : undefined,
    next: index < sorted.length - 1 ? sorted[index + 1] : undefined,
  };
}

export function getTotalCount(): number {
  return data.total;
}
