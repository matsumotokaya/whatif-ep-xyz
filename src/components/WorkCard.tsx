"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { WorkListItem } from "@/lib/types";

interface WorkCardProps {
  work: WorkListItem;
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

export function WorkCard({ work, style }: WorkCardProps) {
  // imageCandidates is pre-computed server-side (feedImageUrl first if present).
  const { imageCandidates, hasWallpaperOffer, hasStarterOffer } = work;
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const src = imageCandidates[index] ?? null;

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
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-all duration-500 ease-out group-hover:scale-[1.03] ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
            loading="lazy"
            onError={() => setIndex((current) => current + 1)}
            onLoad={() => setIsLoading(false)}
          />
        ) : (
          <WorkPlaceholder code={work.displayCode} />
        )}

        <div className="pointer-events-none absolute left-2 top-2 flex gap-1">
          {hasWallpaperOffer && (
            <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-foreground backdrop-blur-sm">
              Wallpaper
            </span>
          )}
          {hasStarterOffer && (
            <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-foreground backdrop-blur-sm">
              Edit
            </span>
          )}
        </div>
      </div>

      <div className="p-2 sm:p-3">
        <p className="font-mono text-[11px] text-muted">#{work.displayCode}</p>
        <p className="mt-0.5 truncate text-sm text-foreground">{work.title}</p>
        {work.themeCategory && (
          <p className="mt-0.5 text-[11px] text-muted">{work.themeCategory}</p>
        )}
      </div>
    </Link>
  );
}
