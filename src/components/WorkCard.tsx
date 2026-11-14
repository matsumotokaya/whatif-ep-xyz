"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { WorkCardVideo, WorkListItem } from "@/lib/types";
import { useLanguage, type Language } from "@/context/LanguageContext";
import { SaveButton } from "@/components/SaveButton";

// Localized badge labels for the work card overlay tags.
const BADGE_COPY: Record<
  Language,
  { wallpaper: string; purchased: string; previous: string; next: string }
> = {
  en: { wallpaper: "Wallpaper", purchased: "Purchased", previous: "Previous image", next: "Next image" },
  ja: { wallpaper: "壁紙", purchased: "購入済み", previous: "前の画像", next: "次の画像" },
  "zh-CN": { wallpaper: "壁纸", purchased: "已购买", previous: "上一张", next: "下一张" },
  "zh-TW": { wallpaper: "桌布", purchased: "已購買", previous: "上一張", next: "下一張" },
  ko: { wallpaper: "배경화면", purchased: "구매 완료", previous: "이전 이미지", next: "다음 이미지" },
};

const CARD_IMAGE_SIZES = "(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 25vw";

interface WorkCardProps {
  work: WorkListItem;
  /** True when the signed-in user has purchased this work's wallpaper. */
  purchased?: boolean;
  style?: React.CSSProperties;
  eager?: boolean;
}

function WorkPlaceholder({ code }: { code: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface to-surface-hover">
      <span className="font-mono text-xs text-muted">WORK</span>
      <span className="font-mono text-2xl font-bold text-foreground/20">{code}</span>
    </div>
  );
}

/**
 * One image with its own fallback chain. All sources are served unoptimized:
 * feed_thumb is already a pre-sized WebP and the fallbacks come from R2
 * (egress-free), bypassing Vercel Image Optimization's 402-on-quota failure.
 */
function CardImage({
  candidates,
  alt,
  code,
  eager,
}: {
  candidates: string[];
  alt: string;
  code: string;
  eager: boolean;
}) {
  const [index, setIndex] = useState(0);
  const src = candidates[index] ?? null;
  if (!src) return <WorkPlaceholder code={code} />;
  return (
    <Image
      key={src}
      src={src}
      alt={alt}
      fill
      unoptimized
      draggable={false}
      sizes={CARD_IMAGE_SIZES}
      className="object-cover"
      loading={eager ? "eager" : "lazy"}
      onError={() => setIndex((prev) => prev + 1)}
    />
  );
}

/**
 * Motion card: plays its small silent preview only while at least half of the
 * card is on screen (Pinterest-style), and pauses off screen so a long gallery
 * does not keep dozens of videos decoding. Reduced motion keeps the poster.
 */
function CardVideo({ video, title }: { video: WorkCardVideo; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void element.play().catch(() => {
            // Autoplay can be refused (e.g. low-power mode); the poster stays.
          });
        } else {
          element.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [video.previewUrl]);

  return (
    <video
      ref={videoRef}
      src={video.previewUrl}
      poster={video.posterUrl ?? undefined}
      muted
      loop
      playsInline
      preload="none"
      aria-label={title}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

function VideoIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6 drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}

// Overlay content is revealed on hover (pointer devices) or keyboard focus.
// Touch devices show the artwork only, like Pinterest.
const REVEAL_CLASS =
  "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none";

export function WorkCard({ work, purchased = false, style, eager = false }: WorkCardProps) {
  const { lang } = useLanguage();
  const copy = BADGE_COPY[lang];
  const trackRef = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  const primaryCandidates = [
    ...(work.feedThumbUrl ? [work.feedThumbUrl] : []),
    ...work.imageCandidates,
  ];
  const slides = work.slides ?? [];
  const isCarousel = slides.length > 1;
  const currentVariant = isCarousel ? slides[slideIndex]?.variantNumber : undefined;
  const href = `/works/${work.seriesSlug}/${work.displayCode}${
    isCarousel && slideIndex > 0 && currentVariant ? `?variant=${currentVariant}` : ""
  }`;

  const goTo = (event: React.MouseEvent, nextIndex: number) => {
    // The arrows live inside the card link; keep them from navigating.
    event.preventDefault();
    event.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(slides.length - 1, nextIndex));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    setSlideIndex(clamped);
  };

  return (
    <div style={style}>
      <Link
        href={href}
        prefetch={false}
        aria-label={`#${work.displayCode} ${work.title}`}
        className="group relative block overflow-hidden rounded-2xl bg-surface-hover"
      >
        <div className="relative" style={{ aspectRatio: work.aspectRatio }}>
          {work.video ? (
            <CardVideo video={work.video} title={work.title} />
          ) : isCarousel ? (
            // Native scroll-snap track: swipe on touch, arrows on hover.
            <div
              ref={trackRef}
              onScroll={(event) => {
                const track = event.currentTarget;
                if (track.clientWidth === 0) return;
                setSlideIndex(Math.round(track.scrollLeft / track.clientWidth));
              }}
              className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
            >
              {slides.map((slide, index) => (
                <div key={slide.variantNumber} className="relative h-full w-full shrink-0 snap-start">
                  <CardImage
                    candidates={slide.candidates}
                    alt={index === 0 ? work.title : `${work.title} (${index + 1})`}
                    code={work.displayCode}
                    eager={eager && index === 0}
                  />
                </div>
              ))}
            </div>
          ) : (
            <CardImage
              candidates={primaryCandidates}
              alt={work.title}
              code={work.displayCode}
              eager={eager}
            />
          )}

          {/* Hover layer: dim + bottom gradient for legible text. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/25 ${REVEAL_CLASS}`}
          />

          <div className={`pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1.5 ${REVEAL_CLASS}`}>
            {work.hasWallpaperOffer && (
              <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-black">
                {copy.wallpaper}
              </span>
            )}
            {purchased && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-semibold text-white">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {copy.purchased}
              </span>
            )}
          </div>

          {work.video && (
            // Always-visible "this is a video" marker; yields to the save
            // button that appears in the same corner on hover.
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0"
            >
              <VideoIcon />
            </div>
          )}

          {/* z-20: stays above the full-height carousel arrows, which would
              otherwise swallow taps on the save button in this corner. */}
          <div className={`absolute right-2 top-2 z-20 ${REVEAL_CLASS}`}>
            <SaveButton workId={work.id} size="card" />
          </div>

          {isCarousel && (
            <>
              {slideIndex > 0 && (
                <button
                  type="button"
                  aria-label={copy.previous}
                  onClick={(event) => goTo(event, slideIndex - 1)}
                  className={`absolute inset-y-0 left-0 flex w-10 items-center justify-center text-white ${REVEAL_CLASS}`}
                >
                  <Chevron direction="left" />
                </button>
              )}
              {slideIndex < slides.length - 1 && (
                <button
                  type="button"
                  aria-label={copy.next}
                  onClick={(event) => goTo(event, slideIndex + 1)}
                  className={`absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white ${REVEAL_CLASS}`}
                >
                  <Chevron direction="right" />
                </button>
              )}
            </>
          )}

          {/* Carousel indicator sits inside the card so every grid cell keeps
              the same height. Always visible; it signals more images. */}
          {isCarousel && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center"
            >
              <div className="flex gap-1 rounded-full bg-black/30 px-1.5 py-1 backdrop-blur-sm">
                {slides.map((slide, index) => (
                  <span
                    key={slide.variantNumber}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      index === slideIndex ? "bg-white" : "bg-white/45"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 p-3 text-white ${
              isCarousel ? "pb-7" : ""
            } ${REVEAL_CLASS}`}
          >
            <p className="font-mono text-[11px] text-white/75">#{work.displayCode}</p>
            <p className="mt-0.5 truncate text-sm font-medium">{work.title}</p>
            {work.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-white/80">
                {work.tags.slice(0, 3).map((tag) => (
                  <span key={tag.id}>#{tag.label}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>

    </div>
  );
}
