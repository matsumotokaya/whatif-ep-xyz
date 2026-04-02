import type { Metadata } from "next";
import { getAllEpisodes, getTotalCount } from "@/lib/episodes";
import { EpisodesPageClient } from "./EpisodesPageClient";

export const metadata: Metadata = {
  title: "Episodes",
  description: "Browse all WHATIF episodes",
};

export default function EpisodesPage() {
  const newestFirst = getAllEpisodes("newest");
  const oldestFirst = getAllEpisodes("oldest");
  const total = getTotalCount();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight neon-text-cyan">
          Episodes
        </h1>
        <p className="mt-2 text-sm text-muted">{total} episodes</p>
      </div>

      <EpisodesPageClient
        newestFirst={newestFirst}
        oldestFirst={oldestFirst}
        total={total}
      />
    </div>
  );
}
