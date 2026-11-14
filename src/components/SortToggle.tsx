"use client";

import { useLanguage, type Language } from "@/context/LanguageContext";
import { PillSelectChevron, PILL_SELECT_CLASS } from "@/components/PillSelect";

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
    <span className="relative inline-flex shrink-0">
      <select
        aria-label={t.label}
        value={sort}
        onChange={(event) =>
          onSortChange(event.target.value as "newest" | "oldest")
        }
        className={PILL_SELECT_CLASS}
      >
        <option value="newest">{t.newest}</option>
        <option value="oldest">{t.oldest}</option>
      </select>
      <PillSelectChevron />
    </span>
  );
}
