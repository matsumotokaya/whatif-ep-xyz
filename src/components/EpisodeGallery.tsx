"use client";

import { useState, useCallback } from "react";
import type { Episode } from "@/lib/types";
import { EpisodeCard } from "./EpisodeCard";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const ITEMS_PER_PAGE = 20;

interface EpisodeGalleryProps {
  initialEpisodes: Episode[];
  allEpisodes: Episode[];
  total: number;
}

export function EpisodeGallery({
  initialEpisodes,
  allEpisodes,
  total,
}: EpisodeGalleryProps) {
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes);
  const [isLoading, setIsLoading] = useState(false);
  const hasMore = episodes.length < allEpisodes.length;

  const loadMore = useCallback(() => {
    setIsLoading(true);
    const nextPage = allEpisodes.slice(
      episodes.length,
      episodes.length + ITEMS_PER_PAGE
    );
    setEpisodes((prev) => [...prev, ...nextPage]);
    setIsLoading(false);
  }, [episodes.length, allEpisodes]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted">
          {episodes.length} / {total} episodes
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4 lg:grid-cols-5 md:gap-3">
        {episodes.map((episode) => (
          <EpisodeCard key={episode.id} episode={episode} />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex justify-center py-8">
        {isLoading && (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
        )}
        {!hasMore && episodes.length > 0 && (
          <p className="text-sm text-muted">All episodes loaded</p>
        )}
      </div>
    </div>
  );
}
