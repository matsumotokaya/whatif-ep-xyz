"use client";

import { useState } from "react";
import type { Episode } from "@/lib/types";
import { EpisodeGallery } from "@/components/EpisodeGallery";
import { SortToggle } from "@/components/SortToggle";

const ITEMS_PER_PAGE = 20;

interface EpisodesPageClientProps {
  newestFirst: Episode[];
  oldestFirst: Episode[];
  total: number;
}

export function EpisodesPageClient({
  newestFirst,
  oldestFirst,
  total,
}: EpisodesPageClientProps) {
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const allEpisodes = sort === "newest" ? newestFirst : oldestFirst;
  const initialEpisodes = allEpisodes.slice(0, ITEMS_PER_PAGE);

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <SortToggle sort={sort} onSortChange={setSort} />
      </div>

      <EpisodeGallery
        key={sort}
        initialEpisodes={initialEpisodes}
        allEpisodes={allEpisodes}
        total={total}
      />
    </div>
  );
}
