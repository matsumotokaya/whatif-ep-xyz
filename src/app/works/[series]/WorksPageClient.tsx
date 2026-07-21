"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GallerySeries,
  WorkFilterMeta,
  WorkListItem,
  WorkListPage,
} from "@/lib/types";
import { GallerySeriesSelect } from "@/components/GallerySeriesSelect";
import { SortToggle } from "@/components/SortToggle";
import { WorkGallery } from "@/components/WorkGallery";
import { useLanguage, type Language } from "@/context/LanguageContext";
import {
  SavedWorksProvider,
  useSavedWorks,
} from "@/context/SavedWorksContext";
import { cn } from "@/lib/utils";

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
    loadError: string;
    retry: string;
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
    loadError: "Works could not be loaded. The current list has been kept.",
    retry: "Try again",
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
    loadError: "作品を読み込めませんでした。現在の一覧は保持されています。",
    retry: "再試行",
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
    loadError: "无法加载作品。当前列表已保留。",
    retry: "重试",
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
    loadError: "無法載入作品。目前的列表已保留。",
    retry: "重試",
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
    loadError: "작품을 불러오지 못했습니다. 현재 목록은 유지됩니다.",
    retry: "다시 시도",
  },
};

const WORKS_PAGE_SIZE = 20;

type WorkRange = {
  id: string;
  label: string;
  start: number;
  end: number;
};

type LoadFailure = {
  cursor: number | null;
  replace: boolean;
};

interface WorksPageClientProps {
  series: GallerySeries[];
  selectedSeriesSlug: string;
  initialPage: WorkListPage;
  filterMeta: WorkFilterMeta;
  initialSelectedTagId?: string | null;
}

function buildWorkRanges(maxSequence: number): WorkRange[] {
  const ranges: WorkRange[] = [];
  for (let start = 1; start <= maxSequence; start += 100) {
    const end = Math.min(start + 99, maxSequence);
    ranges.push({
      id: `${start}-${end}`,
      label: `${start}-${end}`,
      start,
      end,
    });
  }
  return ranges;
}

function WorksPageInner({
  series,
  selectedSeriesSlug,
  initialPage,
  filterMeta,
  purchasedCodes,
  savedWorkIds,
  initialSelectedTagId,
}: {
  series: GallerySeries[];
  selectedSeriesSlug: string;
  initialPage: WorkListPage;
  filterMeta: WorkFilterMeta;
  purchasedCodes: string[];
  savedWorkIds: string[];
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
  const [works, setWorks] = useState<WorkListItem[]>(initialPage.items);
  const [total, setTotal] = useState(initialPage.total);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const ranges = buildWorkRanges(filterMeta.maxSequence);
  const tagFilters = filterMeta.tagFilters;
  const selectedTag =
    selectedTagId
      ? tagFilters.find((tag) => tag.id === selectedTagId) ?? null
      : null;

  const savedIdsKey = savedWorkIds.join(",");
  const rangeKey = selectedRange?.id ?? "all";
  const queryKey = [
    selectedSeriesSlug,
    sort,
    rangeKey,
    wallpaperOnly ? "wallpaper" : "all-wallpapers",
    selectedTagId ?? "all-tags",
    savedOnly ? savedIdsKey : "all-works",
  ].join("|");
  const defaultQueryKey = [
    selectedSeriesSlug,
    "newest",
    "all",
    "all-wallpapers",
    initialSelectedTagId ?? "all-tags",
    "all-works",
  ].join("|");

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

  const loadPage = useCallback(async (cursor: number | null, replace: boolean) => {
    const requestId = ++requestIdRef.current;

    if (savedOnly && savedWorkIds.length === 0) {
      setWorks([]);
      setTotal(0);
      setHasMore(false);
      setNextCursor(null);
      setIsLoading(false);
      setLoadFailure(null);
      return;
    }

    setIsLoading(true);
    setLoadFailure(null);

    const params = new URLSearchParams({
      sort,
      limit: String(WORKS_PAGE_SIZE),
    });
    if (cursor !== null) {
      params.set("cursor", String(cursor));
    }

    if (selectedRange) {
      params.set("rangeStart", String(selectedRange.start));
      params.set("rangeEnd", String(selectedRange.end));
    }
    if (selectedTagId) {
      params.set("tag", selectedTagId);
    }
    if (wallpaperOnly) {
      params.set("wallpaperOnly", "1");
    }
    if (savedOnly && savedWorkIds.length > 0) {
      params.set("ids", savedWorkIds.join(","));
    }

    try {
      const response = await fetch(
        `/api/works/${selectedSeriesSlug}/cards?${params.toString()}`,
        { credentials: "same-origin" }
      );

      if (!response.ok) {
        throw new Error(`Failed to load works page: ${response.status}`);
      }

      const page = (await response.json()) as WorkListPage;
      if (requestId !== requestIdRef.current) return;

      setWorks((current) =>
        replace ? page.items : [...current, ...page.items]
      );
      setTotal(page.total);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      setLoadFailure(null);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error(error);
      setLoadFailure({ cursor, replace });
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    savedOnly,
    savedWorkIds,
    sort,
    selectedRange,
    selectedTagId,
    wallpaperOnly,
    selectedSeriesSlug,
  ]);

  useEffect(() => {
    if (queryKey === defaultQueryKey) {
      requestIdRef.current += 1;
      setWorks(initialPage.items);
      setTotal(initialPage.total);
      setHasMore(initialPage.hasMore);
      setNextCursor(initialPage.nextCursor);
      setIsLoading(false);
      setLoadFailure(null);
      return;
    }

    loadPage(null, true);
  }, [defaultQueryKey, initialPage, loadPage, queryKey]);

  const progress = total > 0 ? (works.length / total) * 100 : 0;
  const displayedWorks = savedOnly ? works.filter((work) => isSaved(work.id)) : works;

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

      {loadFailure && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"
        >
          <p className="text-pretty text-sm">{t.loadError}</p>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => loadPage(loadFailure.cursor, loadFailure.replace)}
            className="btn-press rounded-lg border border-current px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-900/40"
          >
            {t.retry}
          </button>
        </div>
      )}

      {displayedWorks.length > 0 ? (
        <>
          <div className="mb-6 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-foreground/30 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="shrink-0 text-xs tabular-nums text-muted">
              {works.length} / {total}
            </p>
          </div>

          <WorkGallery
            works={displayedWorks}
            hasMore={!savedOnly && hasMore && !loadFailure}
            isLoading={isLoading}
            onLoadMore={() => {
              if (
                !hasMore ||
                nextCursor === null ||
                isLoading ||
                savedOnly ||
                loadFailure
              ) return;
              loadPage(nextCursor, false);
            }}
            purchasedCodes={purchasedCodeSet}
          />
        </>
      ) : savedOnly ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-foreground">{t.emptyTitle}</p>
          <p className="mt-2 text-sm text-muted">{t.emptyBody}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-foreground">
            {filterMeta.total === 0 ? "Coming soon" : t.noMatchTitle}
          </p>
          <p className="mt-2 text-sm text-muted">
            {filterMeta.total === 0
              ? "This series has not been published yet."
              : t.noMatchBody}
          </p>
        </div>
      )}
    </div>
  );
}

export function WorksPageClient({
  ...rest
}: WorksPageClientProps) {
  const [savedWorkIds, setSavedWorkIds] = useState<string[]>([]);
  const [purchasedCodes, setPurchasedCodes] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    void fetch(`/api/works/${rest.selectedSeriesSlug}/user-state`, {
      credentials: "same-origin",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (!active || !payload || typeof payload !== "object") return;
        const state = payload as {
          savedWorkIds?: unknown;
          purchasedCodes?: unknown;
        };
        if (Array.isArray(state.savedWorkIds)) {
          setSavedWorkIds(
            state.savedWorkIds.filter((id): id is string => typeof id === "string")
          );
        }
        if (Array.isArray(state.purchasedCodes)) {
          setPurchasedCodes(
            state.purchasedCodes.filter((code): code is string => typeof code === "string")
          );
        }
      })
      .catch(() => {
        // User-specific highlights are progressive enhancement.
      });

    return () => {
      active = false;
    };
  }, [rest.selectedSeriesSlug]);

  return (
    <SavedWorksProvider initialSavedIds={savedWorkIds}>
      <WorksPageInner
        {...rest}
        purchasedCodes={purchasedCodes}
        savedWorkIds={savedWorkIds}
      />
    </SavedWorksProvider>
  );
}
