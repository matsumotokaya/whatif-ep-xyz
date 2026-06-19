"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { WorkListItem } from "@/lib/types";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { WorkCard } from "./WorkCard";

const ITEMS_PER_PAGE = 20;

interface WorkGalleryProps {
  initialWorks: WorkListItem[];
  allWorks: WorkListItem[];
  total: number;
}

export function WorkGallery({ initialWorks, allWorks, total }: WorkGalleryProps) {
  const [works, setWorks] = useState<WorkListItem[]>(initialWorks);
  const [isLoading, setIsLoading] = useState(false);
  const hasMore = works.length < allWorks.length;

  const loadMore = useCallback(() => {
    setIsLoading(true);
    const nextPage = allWorks.slice(works.length, works.length + ITEMS_PER_PAGE);
    setWorks((prev) => [...prev, ...nextPage]);
    setIsLoading(false);
  }, [allWorks, works.length]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
  });

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
  }, [works.length]);

  const progress = total > 0 ? (works.length / total) * 100 : 0;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-foreground/30 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="shrink-0 text-xs tabular-nums text-muted">
          {works.length} / {total}
        </p>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5"
      >
        {works.map((work, index) => (
          <div
            key={work.id}
            data-card
            className="opacity-0"
            style={{ animationDelay: `${(index % ITEMS_PER_PAGE) * 30}ms` }}
          >
            <WorkCard work={work} />
          </div>
        ))}
      </div>

      <div ref={sentinelRef} className="flex justify-center py-8">
        {isLoading && (
          <div className="dot-loader flex gap-1.5">
            <span />
            <span />
            <span />
          </div>
        )}
        {!hasMore && works.length > 0 && <p className="text-xs text-muted">All works loaded</p>}
      </div>
    </div>
  );
}
