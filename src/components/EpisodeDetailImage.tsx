"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface EpisodeDetailImageProps {
  candidates: string[];
  alt: string;
  /** Load eagerly (default). Off-screen carousel slides pass false. */
  priority?: boolean;
}

export function EpisodeDetailImage({
  candidates,
  alt,
  priority = true,
}: EpisodeDetailImageProps) {
  const [index, setIndex] = useState(0);
  const upgradedRef = useRef(false);
  const src = candidates[index] ?? "";

  useEffect(() => {
    upgradedRef.current = false;
  }, [candidates]);

  return (
    <div className="relative h-full w-full">
      <Image
        key={src}
        src={src}
        alt={alt}
        fill
        // Served directly from R2 (egress-free) instead of through Vercel Image
        // Optimization. The feed PNG is already a sensible size, and this avoids
        // the /_next/image transformation quota (which returns 402 once exhausted).
        unoptimized
        sizes="(min-width: 1024px) calc(100vw - 360px), 100vw"
        className="object-contain object-top p-2 sm:p-4 lg:p-8"
        priority={priority}
        loading={priority ? undefined : "lazy"}
        onError={() => {
          setIndex((current) => current + 1);
        }}
        onLoad={() => {
          // Paint a lightweight preview first, then upgrade once the heavier
          // source finishes in the background. This keeps detail navigation
          // responsive without permanently locking the page to the preview.
          if (index !== 0 || candidates.length < 2 || upgradedRef.current) {
            return;
          }

          const nextSrc = candidates[1];
          if (!nextSrc || nextSrc === src) {
            return;
          }

          upgradedRef.current = true;
          const preload = new window.Image();
          preload.onload = () => {
            setIndex(1);
          };
          preload.onerror = () => {
            upgradedRef.current = false;
          };
          preload.src = nextSrc;
        }}
      />
    </div>
  );
}
