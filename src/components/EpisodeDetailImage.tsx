"use client";

import Image from "next/image";
import { useState } from "react";

interface EpisodeDetailImageProps {
  candidates: string[];
  alt: string;
}

export function EpisodeDetailImage({ candidates, alt }: EpisodeDetailImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const src = candidates[index] ?? "";

  return (
    <div className="relative h-full w-full">
      {isLoading && src && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="shimmer h-full w-full" />
        </div>
      )}
      <Image
        key={src}
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        className={`object-contain object-top p-2 transition-opacity duration-500 ease-out sm:p-4 lg:p-8 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        priority
        onError={() => {
          setIsLoading(true);
          setIndex((current) => current + 1);
        }}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
