"use client";

import Image from "next/image";
import { useState } from "react";

interface EpisodeDetailImageProps {
  src: string;
  alt: string;
}

export function EpisodeDetailImage({ src, alt }: EpisodeDetailImageProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/50">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        className={`object-contain object-top p-2 sm:p-4 lg:p-8 transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        priority
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
