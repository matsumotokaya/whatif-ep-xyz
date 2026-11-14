"use client";

import { useRouter } from "next/navigation";
import type { GallerySeries } from "@/lib/types";
import { useLanguage, type Language } from "@/context/LanguageContext";
import { PillSelectChevron, PILL_SELECT_CLASS } from "@/components/PillSelect";

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
  /** "pill" drops the visible label for the compact gallery toolbar. */
  variant?: "default" | "pill";
}

export function GallerySeriesSelect({
  series,
  selectedSlug,
  className,
  variant = "default",
}: GallerySeriesSelectProps) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = COPY[lang];

  const options = series.map((item) => {
    const suffix = item.workCount > 0 ? ` (${item.workCount})` : ` (${t.comingSoon})`;
    return (
      <option key={item.id} value={item.slug}>
        {item.name}
        {suffix}
      </option>
    );
  });
  const handleChange = (nextSlug: string) => {
    if (!nextSlug || nextSlug === selectedSlug) return;
    router.push(`/works/${nextSlug}`);
  };

  if (variant === "pill") {
    return (
      <span className={`relative inline-flex shrink-0 ${className ?? ""}`}>
        <select
          aria-label={t.series}
          value={selectedSlug}
          onChange={(event) => handleChange(event.target.value)}
          className={PILL_SELECT_CLASS}
        >
          {options}
        </select>
        <PillSelectChevron />
      </span>
    );
  }

  return (
    <label className={`inline-flex items-center gap-2 text-xs text-muted ${className ?? ""}`}>
      <span className="shrink-0">{t.series}</span>
      <select
        aria-label={t.series}
        value={selectedSlug}
        onChange={(event) => handleChange(event.target.value)}
        className="h-10 min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
      >
        {options}
      </select>
    </label>
  );
}
