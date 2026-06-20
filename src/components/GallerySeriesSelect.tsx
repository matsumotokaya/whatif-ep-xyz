"use client";

import { useRouter } from "next/navigation";
import type { GallerySeries } from "@/lib/types";
import { useLanguage, type Language } from "@/context/LanguageContext";

const COPY: Record<Language, { series: string; comingSoon: string }> = {
  en: { series: "Series", comingSoon: "Coming soon" },
  ja: { series: "シリーズ", comingSoon: "近日公開" },
  "zh-CN": { series: "系列", comingSoon: "即将推出" },
  "zh-TW": { series: "系列", comingSoon: "即將推出" },
  ko: { series: "시리즈", comingSoon: "곧 출시" },
};

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
  const { lang } = useLanguage();
  const t = COPY[lang];

  return (
    <label className={`inline-flex items-center gap-2 text-xs text-muted ${className ?? ""}`}>
      <span className="uppercase tracking-[0.18em]">{t.series}</span>
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
          const suffix = item.workCount > 0 ? ` (${item.workCount})` : ` (${t.comingSoon})`;
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
