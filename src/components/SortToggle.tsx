"use client";

import { useLanguage, type Language } from "@/context/LanguageContext";

const COPY: Record<
  Language,
  { label: string; newest: string; oldest: string }
> = {
  en: { label: "Sort", newest: "Newest", oldest: "Oldest" },
  ja: { label: "並び順", newest: "新しい順", oldest: "古い順" },
  "zh-CN": { label: "排序", newest: "最新", oldest: "最早" },
  "zh-TW": { label: "排序", newest: "最新", oldest: "最早" },
  ko: { label: "정렬", newest: "최신순", oldest: "오래된순" },
};

interface SortToggleProps {
  sort: "newest" | "oldest";
  onSortChange: (sort: "newest" | "oldest") => void;
}

export function SortToggle({ sort, onSortChange }: SortToggleProps) {
  const { lang } = useLanguage();
  const t = COPY[lang];

  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted">
      <span>{t.label}</span>
      <select
        aria-label={t.label}
        value={sort}
        onChange={(event) =>
          onSortChange(event.target.value as "newest" | "oldest")
        }
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-surface-hover"
      >
        <option value="newest">{t.newest}</option>
        <option value="oldest">{t.oldest}</option>
      </select>
    </label>
  );
}
