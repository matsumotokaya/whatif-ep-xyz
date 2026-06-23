"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { WorkListItem } from "@/lib/types";
import { useLanguage, type Language } from "@/context/LanguageContext";
import { SaveButton } from "@/components/SaveButton";

// Localized badge labels for the work card overlay tags.
const BADGE_COPY: Record<
  Language,
  { wallpaper: string; edit: string; purchased: string }
> = {
  en: { wallpaper: "Wallpaper", edit: "Edit", purchased: "Purchased" },
  ja: { wallpaper: "壁紙", edit: "編集", purchased: "購入済み" },
  "zh-CN": { wallpaper: "壁纸", edit: "编辑", purchased: "已购买" },
  "zh-TW": { wallpaper: "桌布", edit: "編輯", purchased: "已購買" },
  ko: { wallpaper: "배경화면", edit: "편집", purchased: "구매 완료" },
};

interface WorkCardProps {
  work: WorkListItem;
  /** True when the signed-in user has purchased this work's wallpaper. */
  purchased?: boolean;
  style?: React.CSSProperties;
}

function WorkPlaceholder({ code }: { code: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface to-surface-hover">
      <span className="font-mono text-xs text-muted">WORK</span>
      <span className="font-mono text-2xl font-bold text-foreground/20">{code}</span>
    </div>
  );
}

export function WorkCard({ work, purchased = false, style }: WorkCardProps) {
  // feedThumbUrl is a pre-sized credited thumbnail served `unoptimized` (bypasses
  // Vercel Image Optimization). When present it is tried first; on error we fall
  // back to imageCandidates (feedImageUrl + variant images) rendered via normal
  // optimized next/image. The full-size feed PNG is NEVER served unoptimized.
  const { feedThumbUrl, imageCandidates, hasWallpaperOffer, hasStarterOffer } = work;
  const { lang } = useLanguage();
  const badges = BADGE_COPY[lang];
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Index 0 = the unoptimized feed_thumb (when available); the remaining indices
  // map into the optimized imageCandidates fallback chain.
  const sources: { url: string; unoptimized: boolean }[] = [
    ...(feedThumbUrl ? [{ url: feedThumbUrl, unoptimized: true }] : []),
    ...imageCandidates.map((url) => ({ url, unoptimized: false })),
  ];

  const current = sources[index] ?? null;
  const src = current?.url ?? null;

  return (
    <Link
      href={`/works/${work.seriesSlug}/${work.displayCode}`}
      className="hover-lift group relative block overflow-hidden rounded-xl border border-border bg-surface"
      style={style}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface">
        {isLoading && src && <div className="shimmer absolute inset-0" />}
        {src ? (
          <Image
            key={src}
            src={src}
            alt={work.title}
            fill
            unoptimized={current?.unoptimized ?? false}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-all duration-500 ease-out group-hover:scale-[1.03] ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
            loading="lazy"
            onError={() => setIndex((prev) => prev + 1)}
            onLoad={() => setIsLoading(false)}
          />
        ) : (
          <WorkPlaceholder code={work.displayCode} />
        )}

        <div className="absolute right-2 top-2">
          <SaveButton workId={work.id} size="card" />
        </div>

        {purchased && (
          <div className="pointer-events-none absolute bottom-2 left-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {badges.purchased}
            </span>
          </div>
        )}
      </div>

      <div className="p-2 sm:p-3">
        <p className="font-mono text-[11px] text-muted">#{work.displayCode}</p>
        <p className="mt-0.5 truncate text-sm text-foreground">{work.title}</p>
        {work.themeCategory && (
          <p className="mt-0.5 text-[11px] text-muted">{work.themeCategory}</p>
        )}
        {(hasWallpaperOffer || hasStarterOffer) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {hasWallpaperOffer && (
              <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-foreground">
                {badges.wallpaper}
              </span>
            )}
            {hasStarterOffer && (
              <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-foreground">
                {badges.edit}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
