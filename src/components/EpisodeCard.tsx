"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { Episode } from "@/lib/types";
import { getThumbnailCandidates } from "@/lib/images";

interface EpisodeCardProps {
  episode: Episode;
}

function EpisodeSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-surface animate-pulse">
      <div className="h-8 w-8 rounded-full bg-surface-hover" />
    </div>
  );
}

function EpisodePlaceholder({ number }: { number: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface to-surface-hover">
      <span className="font-mono text-xs text-muted">EP</span>
      <span className="font-mono text-2xl font-bold text-neon-cyan/40">
        {number}
      </span>
    </div>
  );
}

export function EpisodeCard({ episode }: EpisodeCardProps) {
  const candidates = getThumbnailCandidates(episode.number);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const src = candidates[index] ?? null;

  return (
    <Link
      href={`/episodes/${episode.number}`}
      className="group relative block overflow-hidden rounded-lg border border-border bg-surface transition-all hover:border-neon-cyan/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)]"
    >
      <div className="relative aspect-square overflow-hidden bg-surface">
        {isLoading && <EpisodeSkeleton />}
        {src && (
          <Image
            key={src}
            src={src}
            alt={episode.title}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-all duration-300 group-hover:scale-105 ${
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
        <p className="text-xs font-mono text-neon-cyan">#{episode.number}</p>
        <p className="mt-1 text-sm text-foreground truncate">{episode.title}</p>
        {episode.category && (
          <p className="mt-1 text-xs text-muted">{episode.category}</p>
        )}
      </div>
    </Link>
  );
}
