"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { Episode } from "@/lib/types";
import { getThumbnailCandidates } from "@/lib/images";

interface EpisodeCardProps {
  episode: Episode;
  style?: React.CSSProperties;
}

function EpisodePlaceholder({ number }: { number: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface to-surface-hover">
      <span className="font-mono text-xs text-muted">EP</span>
      <span className="font-mono text-2xl font-bold text-foreground/20">
        {number}
      </span>
    </div>
  );
}

export function EpisodeCard({ episode, style }: EpisodeCardProps) {
  const candidates = getThumbnailCandidates(episode);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const src = candidates[index] ?? null;

  return (
    <Link
      href={`/episodes/${episode.number}`}
      className="hover-lift group relative block overflow-hidden rounded-xl border border-border bg-surface"
      style={style}
    >
      <div className="relative aspect-square overflow-hidden bg-surface">
        {isLoading && src && <div className="shimmer absolute inset-0" />}
        {src && (
          <Image
            key={src}
            src={src}
            alt={episode.title}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-all duration-500 ease-out group-hover:scale-[1.03] ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
            loading="lazy"
            onError={() => setIndex((i) => i + 1)}
            onLoad={() => setIsLoading(false)}
          />
        )}
        {!src && <EpisodePlaceholder number={episode.number} />}
      </div>
      <div className="p-2 sm:p-3">
        <p className="font-mono text-[11px] text-muted">#{episode.number}</p>
        <p className="mt-0.5 truncate text-sm text-foreground">
          {episode.title}
        </p>
        {episode.category && (
          <p className="mt-0.5 text-[11px] text-muted">{episode.category}</p>
        )}
      </div>
    </Link>
  );
}
