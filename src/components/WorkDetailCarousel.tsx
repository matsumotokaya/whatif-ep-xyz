"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EpisodeDetailImage } from "@/components/EpisodeDetailImage";
import { MotionDetailVideo } from "@/components/MotionDetailVideo";

export interface WorkDetailSlide {
  variantNumber: number;
  candidates: string[];
  imagineUrl: string | null;
  videoUrl: string | null;
  videoHasAudio: boolean;
}

interface WorkDetailCarouselProps {
  slides: WorkDetailSlide[];
  /** Index of the variant the server rendered (from ?variant=). */
  activeIndex: number;
  title: string;
  /** Base path of the work, e.g. /works/episode/0473. */
  basePath: string;
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}

/**
 * Detail-page carousel for works with several variants, matching the gallery
 * card carousel: swipe on touch, arrows on desktop, dots at the bottom.
 *
 * The side panel (wallpaper offer, download, IMAGINE CTA) is rendered by the
 * server for one variant, so a settled slide change replaces ?variant= in the
 * URL. The component itself keeps its scroll position across that re-render
 * and only scrolls when the variant changes from outside (the Variants pills).
 */
export function WorkDetailCarousel({ slides, activeIndex, title, basePath }: WorkDetailCarouselProps) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(activeIndex);
  const indexRef = useRef(activeIndex);
  const settleTimer = useRef<number | null>(null);

  // Start on the server-selected slide without animating.
  useEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = activeIndex * track.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow external navigation (Variants pills / back button).
  useEffect(() => {
    if (activeIndex === indexRef.current) return;
    indexRef.current = activeIndex;
    setIndex(activeIndex);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: activeIndex * track.clientWidth, behavior: "smooth" });
  }, [activeIndex]);

  useEffect(
    () => () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    },
    []
  );

  const syncUrl = (nextIndex: number) => {
    const slide = slides[nextIndex];
    if (!slide) return;
    const href = nextIndex === 0 ? basePath : `${basePath}?variant=${slide.variantNumber}`;
    router.replace(href, { scroll: false });
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const nextIndex = Math.round(track.scrollLeft / track.clientWidth);
    if (nextIndex !== indexRef.current) {
      indexRef.current = nextIndex;
      setIndex(nextIndex);
    }
    // Update the URL once scrolling settles, not on every frame.
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (indexRef.current !== activeIndex) syncUrl(indexRef.current);
    }, 150);
  };

  const goTo = (nextIndex: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(slides.length - 1, nextIndex));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="absolute inset-0">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.variantNumber}
            className="relative h-full w-full shrink-0 snap-start"
            aria-hidden={slideIndex !== index}
          >
            {slide.videoUrl ? (
              <MotionDetailVideo
                src={slide.videoUrl}
                poster={slide.candidates[0] ?? null}
                title={title}
                hasAudio={slide.videoHasAudio}
              />
            ) : (
              <EpisodeDetailImage
                candidates={slide.candidates}
                alt={slideIndex === 0 ? title : `${title} (${slideIndex + 1})`}
                imagineUrl={slide.imagineUrl}
                priority={slideIndex === activeIndex}
              />
            )}
          </div>
        ))}
      </div>

      {index > 0 && (
        <button
          type="button"
          aria-label="Previous image"
          onClick={() => goTo(index - 1)}
          className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <Chevron direction="left" />
        </button>
      )}
      {index < slides.length - 1 && (
        <button
          type="button"
          aria-label="Next image"
          onClick={() => goTo(index + 1)}
          className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <Chevron direction="right" />
        </button>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center sm:bottom-4"
      >
        <div className="flex gap-1.5 rounded-full bg-black/35 px-2 py-1.5 backdrop-blur-sm">
          {slides.map((slide, slideIndex) => (
            <span
              key={slide.variantNumber}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                slideIndex === index ? "bg-white" : "bg-white/45"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
