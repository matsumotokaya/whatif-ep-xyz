"use client";

import { useEffect, useRef, useState } from "react";
import type { GallerySeries, WorkListItem } from "@/lib/types";
import { useResolvedList } from "@/hooks/useResolvedList";
import { GallerySeriesSelect } from "@/components/GallerySeriesSelect";
import { SortToggle } from "@/components/SortToggle";
import { WorkGallery } from "@/components/WorkGallery";
import { useLanguage, type Language } from "@/context/LanguageContext";
import {
  SavedWorksProvider,
  useSavedWorks,
} from "@/context/SavedWorksContext";

const ITEMS_PER_PAGE = 20;

// Localized copy for the SAVED filter toggle and its empty state.
const COPY: Record<
  Language,
  { saved: string; emptyTitle: string; emptyBody: string }
> = {
  en: {
    saved: "Saved",
    emptyTitle: "No saved works",
    emptyBody: "Works you save will appear here.",
  },
  ja: {
    saved: "保存済み",
    emptyTitle: "保存した作品はありません",
    emptyBody: "保存した作品がここに表示されます。",
  },
  "zh-CN": {
    saved: "已保存",
    emptyTitle: "暂无已保存作品",
    emptyBody: "您保存的作品将显示在这里。",
  },
  "zh-TW": {
    saved: "已儲存",
    emptyTitle: "尚無已儲存作品",
    emptyBody: "您儲存的作品將顯示在這裡。",
  },
  ko: {
    saved: "저장됨",
    emptyTitle: "저장한 작품이 없습니다",
    emptyBody: "저장한 작품이 여기에 표시됩니다.",
  },
};

type WorkRange = {
  id: string;
  label: string;
  start: number;
  end: number;
};

interface WorksPageClientProps {
  series: GallerySeries[];
  selectedSeriesSlug: string;
  /** Works in newest-first order. The client reverses for "oldest" sort. */
  works: WorkListItem[];
  total: number;
  /**
   * Display codes the signed-in user has purchased (one-time wallpaper buys).
   * Streamed as a promise so it does not block the catalog render.
   */
  purchasedCodesPromise: Promise<string[]>;
  /**
   * Work ids the signed-in user has saved (across all series).
   * Streamed as a promise so it does not block the catalog render.
   */
  savedWorkIdsPromise: Promise<string[]>;
}

function buildWorkRanges(works: WorkListItem[]): WorkRange[] {
  let max = 0;
  for (const work of works) {
    if (work.sequenceNumber > max) max = work.sequenceNumber;
  }

  const ranges: WorkRange[] = [];
  for (let start = 1; start <= max; start += 100) {
    const end = Math.min(start + 99, max);
    ranges.push({
      id: `${start}-${end}`,
      label: `${start}-${end}`,
      start,
      end,
    });
  }
  return ranges;
}

// Inner component so it can consume the SavedWorksContext for the SAVED filter.
function WorksPageInner({
  series,
  selectedSeriesSlug,
  works,
  purchasedCodes,
}: {
  series: GallerySeries[];
  selectedSeriesSlug: string;
  works: WorkListItem[];
  purchasedCodes: string[];
}) {
  const { lang } = useLanguage();
  const t = COPY[lang];
  const { isSaved } = useSavedWorks();

  const purchasedCodeSet = new Set(purchasedCodes);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<WorkRange | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const ranges = buildWorkRanges(works);
  // works arrives newest-first; reverse a copy for oldest sort (no extra server fetch).
  const sortedWorks = sort === "newest" ? works : [...works].reverse();
  const rangeFilteredWorks = selectedRange
    ? sortedWorks.filter(
        (work) =>
          work.sequenceNumber >= selectedRange.start &&
          work.sequenceNumber <= selectedRange.end
      )
    : sortedWorks;
  // The SAVED filter reacts to the context Set via isSaved.
  const filteredWorks = savedOnly
    ? rangeFilteredWorks.filter((work) => isSaved(work.id))
    : rangeFilteredWorks;
  const filteredTotal = filteredWorks.length;
  const initialWorks = filteredWorks.slice(0, ITEMS_PER_PAGE);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!filterRef.current) return;
      if (!filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <GallerySeriesSelect series={series} selectedSlug={selectedSeriesSlug} />
          <SortToggle sort={sort} onSortChange={setSort} />
          <button
            type="button"
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly((prev) => !prev)}
            className={`btn-press inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              savedOnly
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-foreground hover:bg-surface-hover"
            }`}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill={savedOnly ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z"
              />
            </svg>
            {t.saved}
          </button>
          {ranges.length > 0 && (
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                aria-expanded={filterOpen}
                aria-label="Filter works by range"
                onClick={() => setFilterOpen((prev) => !prev)}
                className="btn-press inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 4h18l-7 8v6l-4 2v-8L3 4z"
                  />
                </svg>
                Filter
              </button>

              {filterOpen && (
                <div className="dropdown-enter absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRange(null);
                      setFilterOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-hover ${
                      selectedRange ? "text-foreground" : "font-medium text-foreground"
                    }`}
                  >
                    All works
                  </button>
                  {ranges.map((range) => {
                    const active = selectedRange?.id === range.id;
                    return (
                      <button
                        key={range.id}
                        type="button"
                        onClick={() => {
                          setSelectedRange(range);
                          setFilterOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-hover ${
                          active ? "font-medium text-foreground" : "text-foreground"
                        }`}
                      >
                        No. {range.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedRange && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground">
            No. {selectedRange.label}
            <button
              type="button"
              aria-label="Clear range filter"
              onClick={() => setSelectedRange(null)}
              className="btn-press inline-flex h-4 w-4 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </span>
        </div>
      )}

      {filteredTotal > 0 ? (
        <WorkGallery
          key={`${selectedSeriesSlug}-${sort}-${selectedRange?.id ?? "all"}-${
            savedOnly ? "saved" : "all"
          }`}
          initialWorks={initialWorks}
          allWorks={filteredWorks}
          total={filteredTotal}
          purchasedCodes={purchasedCodeSet}
        />
      ) : savedOnly ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-foreground">{t.emptyTitle}</p>
          <p className="mt-2 text-sm text-muted">{t.emptyBody}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-foreground">Coming soon</p>
          <p className="mt-2 text-sm text-muted">
            This series has not been published yet.
          </p>
        </div>
      )}
    </div>
  );
}

export function WorksPageClient({
  savedWorkIdsPromise,
  purchasedCodesPromise,
  ...rest
}: WorksPageClientProps) {
  // Resolve the streamed user-specific lists on the client without suspending,
  // so the catalog grid renders immediately and these fill in once available.
  const savedWorkIds = useResolvedList(savedWorkIdsPromise);
  const purchasedCodes = useResolvedList(purchasedCodesPromise);

  return (
    <SavedWorksProvider initialSavedIds={savedWorkIds}>
      <WorksPageInner {...rest} purchasedCodes={purchasedCodes} />
    </SavedWorksProvider>
  );
}
