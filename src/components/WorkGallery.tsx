"use client";

import { memo } from "react";
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

// Cards are rendered in chunks of 60 so React can skip unchanged chunks when a
// page is appended. Chunks use `display: contents`, so every card still lives
// in the one masonry grid below and the layout flows across chunk boundaries.
const GALLERY_RENDER_CHUNK_SIZE = 60;

// Pinterest-style masonry without measuring in JS: grid rows are 1/ROW_UNITS
// of a column width (see .gallery-masonry in globals.css), so a card's row
// span depends only on its aspect ratio. CSS auto-placement then drops each
// card into the column that frees up first — the same order as Pinterest — and
// it renders correctly on the server at every breakpoint.
const ROW_UNITS_PER_COLUMN = 50;
const GAP_UNITS = 2; // must match --gallery-gap-ratio (2 / 50 = 0.04)

// Feature cards: the first card and then every FEATURE_EVERY-th card span two
// columns (2 columns + the gap between them). Placement is left to CSS
// auto-placement, so small gaps can appear around them — accepted by design
// (2026-11-14): the loose, puzzle-like rhythm matters more than exact fit.
const FEATURE_EVERY = 9;

function isFeatureCard(index: number): boolean {
  return index % FEATURE_EVERY === 0;
}

function rowSpan(aspectRatio: number, columns: 1 | 2): number {
  // Card width in column units: 1, or 2 + one gap (2 + 0.04).
  const width = columns === 2 ? 2 + GAP_UNITS / ROW_UNITS_PER_COLUMN : 1;
  return Math.ceil((ROW_UNITS_PER_COLUMN * width) / aspectRatio) + GAP_UNITS;
}

const GalleryCard = memo(function GalleryCard({
  work,
  purchased,
  index,
}: {
  work: WorkListItem;
  purchased: boolean;
  index: number;
}) {
  const feature = isFeatureCard(index);
  return (
    <div
      data-card
      data-feature={feature || undefined}
      data-work-id={work.id}
      data-work-code={work.displayCode}
      data-work-sequence={work.sequenceNumber}
      style={{
        gridRowEnd: `span ${rowSpan(work.aspectRatio, feature ? 2 : 1)}`,
        ...(feature ? { gridColumnEnd: "span 2" } : {}),
      }}
    >
      <WorkCard work={work} purchased={purchased} eager={index < 5} />
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
      <div className="contents">
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
      <div className="gallery-masonry">
        <div className="gallery-masonry-grid">
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
