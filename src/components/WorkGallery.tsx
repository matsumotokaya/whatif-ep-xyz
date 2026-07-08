"use client";

import { useRef, useEffect } from "react";
import type { WorkListItem } from "@/lib/types";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { WorkCard } from "./WorkCard";

interface WorkGalleryProps {
  works: WorkListItem[];
  hasMore: boolean;
  isLoading?: boolean;
  onLoadMore?: () => void;
  /** Display codes the signed-in user has purchased (one-time wallpaper buys). */
  purchasedCodes?: Set<string>;
}

export function WorkGallery({
  works,
  hasMore,
  isLoading = false,
  onLoadMore,
  purchasedCodes,
}: WorkGalleryProps) {
  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: onLoadMore ?? (() => {}),
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

  return (
    <div>
      <div
        ref={gridRef}
        className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5"
      >
        {works.map((work, index) => (
          <div
            key={work.id}
            data-card
            className="opacity-0"
            style={{ animationDelay: `${(index % 20) * 30}ms` }}
          >
            <WorkCard
              work={work}
              purchased={purchasedCodes?.has(work.displayCode) ?? false}
            />
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
