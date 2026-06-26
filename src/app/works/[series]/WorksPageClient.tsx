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
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 20;

// Localized copy for the SAVED filter toggle and its empty state.
const COPY: Record<
  Language,
  {
    saved: string;
    filter: string;
    tags: string;
    wallpaper: string;
    taggedAs: string;
    clearTag: string;
    emptyTitle: string;
    emptyBody: string;
    noMatchTitle: string;
    noMatchBody: string;
  }
> = {
  en: {
    saved: "Saved",
    filter: "Filter",
    tags: "Tags",
    wallpaper: "Wallpaper",
    taggedAs: "Tag",
    clearTag: "Clear tag filter",
    emptyTitle: "No saved works",
    emptyBody: "Works you save will appear here.",
    noMatchTitle: "No matching works",
    noMatchBody: "Try changing the current filters.",
  },
  ja: {
    saved: "保存済み",
    filter: "絞り込み",
    tags: "タグ",
    wallpaper: "壁紙",
    taggedAs: "タグ",
    clearTag: "タグ絞り込みを解除",
    emptyTitle: "保存した作品はありません",
    emptyBody: "保存した作品がここに表示されます。",
    noMatchTitle: "該当する作品がありません",
    noMatchBody: "フィルタ条件を変更してください。",
  },
  "zh-CN": {
    saved: "已保存",
    filter: "筛选",
    tags: "标签",
    wallpaper: "壁纸",
    taggedAs: "标签",
    clearTag: "清除标签筛选",
    emptyTitle: "暂无已保存作品",
    emptyBody: "您保存的作品将显示在这里。",
    noMatchTitle: "没有匹配的作品",
    noMatchBody: "请更改当前筛选条件。",
  },
  "zh-TW": {
    saved: "已儲存",
    filter: "篩選",
    tags: "標籤",
    wallpaper: "桌布",
    taggedAs: "標籤",
    clearTag: "清除標籤篩選",
    emptyTitle: "尚無已儲存作品",
    emptyBody: "您儲存的作品將顯示在這裡。",
    noMatchTitle: "沒有符合的作品",
    noMatchBody: "請變更目前的篩選條件。",
  },
  ko: {
    saved: "저장됨",
    filter: "필터",
    tags: "태그",
    wallpaper: "배경화면",
    taggedAs: "태그",
    clearTag: "태그 필터 해제",
    emptyTitle: "저장한 작품이 없습니다",
    emptyBody: "저장한 작품이 여기에 표시됩니다.",
    noMatchTitle: "일치하는 작품이 없습니다",
    noMatchBody: "현재 필터를 바꿔 보세요.",
  },
};

type WorkRange = {
  id: string;
  label: string;
  start: number;
  end: number;
};

type TagFilterItem = {
  id: string;
  label: string;
  count: number;
};

interface WorksPageClientProps {
  series: GallerySeries[];
  selectedSeriesSlug: string;
  /** Works in newest-first order. The client reverses for "oldest" sort. */
  works: WorkListItem[];
  total: number;
  initialSelectedTagId?: string | null;
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

function buildTagFilters(works: WorkListItem[]): TagFilterItem[] {
  const tags = new Map<string, TagFilterItem>();

  for (const work of works) {
    for (const tag of work.tags) {
      const existing = tags.get(tag.slug);
      if (existing) {
        existing.count += 1;
        continue;
      }

      tags.set(tag.slug, {
        id: tag.slug,
        label: tag.label,
        count: 1,
      });
    }
  }

  return [...tags.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

// Inner component so it can consume the SavedWorksContext for the SAVED filter.
function WorksPageInner({
  series,
  selectedSeriesSlug,
  works,
  purchasedCodes,
  initialSelectedTagId,
}: {
  series: GallerySeries[];
  selectedSeriesSlug: string;
  works: WorkListItem[];
  purchasedCodes: string[];
  initialSelectedTagId?: string | null;
}) {
  const { lang } = useLanguage();
  const t = COPY[lang];
  const { isSaved } = useSavedWorks();

  const purchasedCodeSet = new Set(purchasedCodes);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<WorkRange | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [wallpaperOnly, setWallpaperOnly] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(
    initialSelectedTagId ?? null
  );
  const filterRef = useRef<HTMLDivElement>(null);

  const ranges = buildWorkRanges(works);
  const tagFilters = buildTagFilters(works);
  // works arrives newest-first; reverse a copy for oldest sort (no extra server fetch).
  const sortedWorks = sort === "newest" ? works : [...works].reverse();
  const rangeFilteredWorks = selectedRange
    ? sortedWorks.filter(
        (work) =>
          work.sequenceNumber >= selectedRange.start &&
          work.sequenceNumber <= selectedRange.end
      )
    : sortedWorks;
  const savedFilteredWorks = savedOnly
    ? rangeFilteredWorks.filter((work) => isSaved(work.id))
    : rangeFilteredWorks;
  const wallpaperFilteredWorks = wallpaperOnly
    ? savedFilteredWorks.filter((work) => work.hasWallpaperOffer)
    : savedFilteredWorks;
  const filteredWorks = selectedTagId
    ? wallpaperFilteredWorks.filter((work) =>
        work.tags.some((tag) => tag.slug === selectedTagId)
      )
    : wallpaperFilteredWorks;
  const filteredTotal = filteredWorks.length;
  const initialWorks = filteredWorks.slice(0, ITEMS_PER_PAGE);
  const selectedTag =
    (selectedTagId
      ? tagFilters.find((tag) => tag.id === selectedTagId) ?? null
      : null);

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
          <button
            type="button"
            aria-pressed={wallpaperOnly}
            onClick={() => setWallpaperOnly((prev) => !prev)}
            className={`btn-press inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              wallpaperOnly
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-foreground hover:bg-surface-hover"
            }`}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7h16M4 12h16M4 17h10"
              />
            </svg>
            {t.wallpaper}
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
                {t.filter}
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

      {tagFilters.length > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-surface/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">{t.tags}</span>
            <div className="flex flex-wrap gap-2">
              {tagFilters.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    setSelectedTagId((current) =>
                      current === tag.id ? null : tag.id
                    )
                  }
                  aria-pressed={selectedTagId === tag.id}
                  className={cn(
                    "btn-press rounded-full border px-3 py-1.5 text-xs transition-colors",
                    selectedTagId === tag.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-surface-hover"
                  )}
                >
                  {tag.label} ({tag.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(selectedRange || selectedTag) && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {selectedRange && (
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
          )}
          {selectedTag && (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground">
              {t.taggedAs}: {selectedTag.label}
              <button
                type="button"
                aria-label={t.clearTag}
                onClick={() => setSelectedTagId(null)}
                className="btn-press inline-flex h-4 w-4 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          )}
        </div>
      )}

      {filteredTotal > 0 ? (
        <WorkGallery
          key={`${selectedSeriesSlug}-${sort}-${selectedRange?.id ?? "all"}-${
            savedOnly ? "saved" : "all"
          }-${wallpaperOnly ? "wallpaper" : "all-wallpapers"}-${
            selectedTagId ?? "all-tags"
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
          <p className="text-lg font-semibold text-foreground">
            {works.length === 0 ? "Coming soon" : t.noMatchTitle}
          </p>
          <p className="mt-2 text-sm text-muted">
            {works.length === 0
              ? "This series has not been published yet."
              : t.noMatchBody}
          </p>
        </div>
      )}
    </div>
  );
}

export function WorksPageClient({
  savedWorkIdsPromise,
  purchasedCodesPromise,
  initialSelectedTagId,
  ...rest
}: WorksPageClientProps) {
  // Resolve the streamed user-specific lists on the client without suspending,
  // so the catalog grid renders immediately and these fill in once available.
  const savedWorkIds = useResolvedList(savedWorkIdsPromise);
  const purchasedCodes = useResolvedList(purchasedCodesPromise);

  return (
    <SavedWorksProvider initialSavedIds={savedWorkIds}>
      <WorksPageInner
        {...rest}
        purchasedCodes={purchasedCodes}
        initialSelectedTagId={initialSelectedTagId}
      />
    </SavedWorksProvider>
  );
}
