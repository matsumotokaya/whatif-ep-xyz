"use client";

import { useRouter } from "next/navigation";
import type { GallerySeries } from "@/lib/types";

interface GallerySeriesSelectProps {
  series: GallerySeries[];
  selectedSlug: string;
  className?: string;
}

export function GallerySeriesSelect({
  series,
  selectedSlug,
  className,
}: GallerySeriesSelectProps) {
  const router = useRouter();

  return (
    <label className={`inline-flex items-center gap-2 text-xs text-muted ${className ?? ""}`}>
      <span className="uppercase tracking-[0.18em]">Series</span>
      <select
        aria-label="Select gallery series"
        value={selectedSlug}
        onChange={(event) => {
          const nextSlug = event.target.value;
          if (!nextSlug || nextSlug === selectedSlug) return;
          router.push(`/works/${nextSlug}`);
        }}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-surface-hover"
      >
        {series.map((item) => {
          const suffix = item.workCount > 0 ? ` (${item.workCount})` : " (Coming soon)";
          return (
            <option key={item.id} value={item.slug}>
              {item.name}
              {suffix}
            </option>
          );
        })}
      </select>
    </label>
  );
}
