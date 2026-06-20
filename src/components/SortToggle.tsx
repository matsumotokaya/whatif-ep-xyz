"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { useLanguage, type Language } from "@/context/LanguageContext";

const COPY: Record<Language, { newest: string; oldest: string }> = {
  en: { newest: "Newest", oldest: "Oldest" },
  ja: { newest: "新しい順", oldest: "古い順" },
  "zh-CN": { newest: "最新", oldest: "最早" },
  "zh-TW": { newest: "最新", oldest: "最早" },
  ko: { newest: "최신순", oldest: "오래된순" },
};

interface SortToggleProps {
  sort: "newest" | "oldest";
  onSortChange: (sort: "newest" | "oldest") => void;
}

export function SortToggle({ sort, onSortChange }: SortToggleProps) {
  const { lang } = useLanguage();
  const t = COPY[lang];
  const containerRef = useRef<HTMLDivElement>(null);
  const newestRef = useRef<HTMLButtonElement>(null);
  const oldestRef = useRef<HTMLButtonElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const active = sort === "newest" ? newestRef.current : oldestRef.current;
    const container = containerRef.current;
    if (active && container) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      setIndicator({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
      });
    }
  }, [sort]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-0.5 rounded-lg border border-border bg-surface p-1"
    >
      {/* Sliding indicator */}
      <div
        className="tab-indicator absolute top-1 bottom-1 rounded-md bg-foreground/[0.06]"
        style={{
          left: indicator.left,
          width: indicator.width,
        }}
      />

      <button
        ref={newestRef}
        onClick={() => onSortChange("newest")}
        className={`btn-press relative z-10 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          sort === "newest" ? "text-foreground" : "text-muted hover:text-foreground"
        }`}
      >
        {t.newest}
      </button>
      <button
        ref={oldestRef}
        onClick={() => onSortChange("oldest")}
        className={`btn-press relative z-10 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          sort === "oldest" ? "text-foreground" : "text-muted hover:text-foreground"
        }`}
      >
        {t.oldest}
      </button>
    </div>
  );
}
