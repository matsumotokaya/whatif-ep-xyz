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
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="shimmer h-full w-full" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        className={`object-contain object-top p-2 transition-opacity duration-500 ease-out sm:p-4 lg:p-8 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        priority
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
