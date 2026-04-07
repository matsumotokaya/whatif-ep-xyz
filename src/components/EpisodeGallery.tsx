"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  const prevLengthRef = useRef(initialEpisodes.length);

  const loadMore = useCallback(() => {
    setIsLoading(true);
    const nextPage = allEpisodes.slice(
      episodes.length,
      episodes.length + ITEMS_PER_PAGE
    );
    prevLengthRef.current = episodes.length;
    setEpisodes((prev) => [...prev, ...nextPage]);
    setIsLoading(false);
  }, [episodes.length, allEpisodes]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
  });

  // Observe cards for staggered fade-in
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("animate-fade-in-up");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: "40px" }
    );

    const cards = grid.querySelectorAll("[data-card]");
    cards.forEach((card) => {
      if (!(card as HTMLElement).classList.contains("animate-fade-in-up")) {
        observer.observe(card);
      }
    });

    return () => observer.disconnect();
  }, [episodes.length]);

  const progress = total > 0 ? (episodes.length / total) * 100 : 0;

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-foreground/30 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="shrink-0 text-xs tabular-nums text-muted">
          {episodes.length} / {total}
        </p>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5"
      >
        {episodes.map((episode, i) => (
          <div
            key={episode.id}
            data-card
            className="opacity-0"
            style={{ animationDelay: `${(i % ITEMS_PER_PAGE) * 30}ms` }}
          >
            <EpisodeCard episode={episode} />
          </div>
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex justify-center py-8">
        {isLoading && (
          <div className="dot-loader flex gap-1.5">
            <span />
            <span />
            <span />
          </div>
        )}
        {!hasMore && episodes.length > 0 && (
          <p className="text-xs text-muted">All episodes loaded</p>
        )}
      </div>
    </div>
  );
}
