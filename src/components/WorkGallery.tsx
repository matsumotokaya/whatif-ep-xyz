"use client";

import { memo } from "react";
import type { WorkListItem } from "@/lib/types";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { cn } from "@/lib/utils";
import { WorkCard } from "./WorkCard";

interface WorkGalleryProps {
  works: WorkListItem[];
  hasMore: boolean;
  isLoading?: boolean;
  onLoadMore?: () => void;
  /** Display codes the signed-in user has purchased (one-time wallpaper buys). */
  purchasedCodes?: Set<string>;
}

// 60 is divisible by every responsive column count (3, 4, and 5), so splitting
// the grid does not create partial rows or alter the visual card order.
const GALLERY_RENDER_CHUNK_SIZE = 60;
const GRID_CLASS_NAME =
  "grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5";

const GalleryCard = memo(function GalleryCard({
  work,
  purchased,
  index,
}: {
  work: WorkListItem;
  purchased: boolean;
  index: number;
}) {
  const animateEntrance = index < 20;
  return (
    <div
      data-card
      data-work-id={work.id}
      data-work-code={work.displayCode}
      data-work-sequence={work.sequenceNumber}
      className={cn(
        animateEntrance && "animate-fade-in-up motion-reduce:animate-none"
      )}
      style={
        animateEntrance
          ? { animationDelay: `${index * 30}ms` }
          : undefined
      }
    >
      <WorkCard work={work} purchased={purchased} />
    </div>
  );
});

interface GalleryChunkProps {
  works: WorkListItem[];
  startIndex: number;
  purchasedCodes?: Set<string>;
}

const GalleryChunk = memo(
  function GalleryChunk({
    works,
    startIndex,
    purchasedCodes,
  }: GalleryChunkProps) {
    return (
      <div className={`gallery-card-chunk ${GRID_CLASS_NAME}`}>
        {works.map((work, index) => (
          <GalleryCard
            key={work.id}
            work={work}
            purchased={purchasedCodes?.has(work.displayCode) ?? false}
            index={startIndex + index}
          />
        ))}
      </div>
    );
  },
  (previous, next) =>
    previous.startIndex === next.startIndex &&
    previous.purchasedCodes === next.purchasedCodes &&
    previous.works.length === next.works.length &&
    previous.works[0] === next.works[0] &&
    previous.works.at(-1) === next.works.at(-1)
);

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
    // Start the bounded API request before the sentinel itself is visible. The
    // appended images remain browser-lazy, so this warms data without eagerly
    // downloading the next page's image payload.
    rootMargin: "600px 0px",
  });
  const chunks: WorkListItem[][] = [];
  for (let index = 0; index < works.length; index += GALLERY_RENDER_CHUNK_SIZE) {
    chunks.push(works.slice(index, index + GALLERY_RENDER_CHUNK_SIZE));
  }

  return (
    <div data-gallery-grid>
      <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-3">
        {chunks.map((chunk, chunkIndex) => {
          const startIndex = chunkIndex * GALLERY_RENDER_CHUNK_SIZE;
          return (
            <GalleryChunk
              key={chunk[0]?.id ?? startIndex}
              works={chunk}
              purchasedCodes={purchasedCodes}
              startIndex={startIndex}
            />
          );
        })}
      </div>

      <div
        ref={sentinelRef}
        data-gallery-sentinel
        className="flex justify-center py-8"
      >
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
