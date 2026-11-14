"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  GallerySeries,
  WorkFilterMeta,
  WorkListItem,
  WorkListPage,
} from "@/lib/types";
import { GallerySeriesSelect } from "@/components/GallerySeriesSelect";
import { SortToggle } from "@/components/SortToggle";
import { WorkGallery } from "@/components/WorkGallery";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
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
    all: string;
    allWorks: string;
    filter: string;
    tags: string;
    wallpaper: string;
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
    all: "All",
    allWorks: "All works",
    filter: "Filter",
    tags: "Tags",
    wallpaper: "Wallpaper",
    emptyTitle: "No saved works",
    emptyBody: "Works you save will appear here.",
    noMatchTitle: "No matching works",
    noMatchBody: "Try changing the current filters.",
    loadError: "Works could not be loaded. The current list has been kept.",
    retry: "Try again",
  },
  ja: {
    saved: "保存済み",
    all: "すべて",
    allWorks: "すべての作品",
    filter: "絞り込み",
    tags: "タグ",
    wallpaper: "壁紙",
    emptyTitle: "保存した作品はありません",
    emptyBody: "保存した作品がここに表示されます。",
    noMatchTitle: "該当する作品がありません",
    noMatchBody: "フィルタ条件を変更してください。",
    loadError: "作品を読み込めませんでした。現在の一覧は保持されています。",
    retry: "再試行",
  },
  "zh-CN": {
    saved: "已保存",
    all: "全部",
    allWorks: "全部作品",
    filter: "筛选",
    tags: "标签",
    wallpaper: "壁纸",
    emptyTitle: "暂无已保存作品",
    emptyBody: "您保存的作品将显示在这里。",
    noMatchTitle: "没有匹配的作品",
    noMatchBody: "请更改当前筛选条件。",
    loadError: "无法加载作品。当前列表已保留。",
    retry: "重试",
  },
  "zh-TW": {
    saved: "已儲存",
    all: "全部",
    allWorks: "全部作品",
    filter: "篩選",
    tags: "標籤",
    wallpaper: "桌布",
    emptyTitle: "尚無已儲存作品",
    emptyBody: "您儲存的作品將顯示在這裡。",
    noMatchTitle: "沒有符合的作品",
    noMatchBody: "請變更目前的篩選條件。",
    loadError: "無法載入作品。目前的列表已保留。",
    retry: "重試",
  },
  ko: {
    saved: "저장됨",
    all: "전체",
    allWorks: "전체 작품",
    filter: "필터",
    tags: "태그",
    wallpaper: "배경화면",
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
  seriesName: string;
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
  seriesName,
  initialPage,
  filterMeta,
  purchasedCodes,
  savedWorkIds,
  initialSelectedTagId,
}: {
  series: GallerySeries[];
  selectedSeriesSlug: string;
  seriesName: string;
  initialPage: WorkListPage;
  filterMeta: WorkFilterMeta;
  purchasedCodes: string[];
  savedWorkIds: string[];
  initialSelectedTagId?: string | null;
}) {
  const { lang } = useLanguage();
  const t = COPY[lang];
  const { isSaved } = useSavedWorks();

  const purchasedCodeSet = useMemo(() => new Set(purchasedCodes), [purchasedCodes]);
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
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const filterRowRef = useRef<HTMLDivElement>(null);
  const tagRowRef = useRef<HTMLDivElement>(null);
  const [filterMenuPos, setFilterMenuPos] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useHideOnScroll(toolbarRef);
  const requestIdRef = useRef(0);
  const activeRequestKeyRef = useRef<string | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  const ranges = buildWorkRanges(filterMeta.maxSequence);
  const tagFilters = filterMeta.tagFilters;

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
      const target = event.target as Node;
      if (filterRef.current?.contains(target)) return;
      if (filterMenuRef.current?.contains(target)) return;
      setFilterOpen(false);
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

  // The range menu is portaled so the horizontally scrolling toolbar row
  // cannot clip it. It is anchored to the button and closes on any scroll.
  useLayoutEffect(() => {
    if (!filterOpen) {
      setFilterMenuPos(null);
      return;
    }
    const button = filterButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuWidth = 208;
    setFilterMenuPos({
      top: rect.bottom + 8,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12)),
    });

    const close = () => setFilterOpen(false);
    const row = filterRowRef.current;
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    row?.addEventListener("scroll", close, { passive: true });
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      row?.removeEventListener("scroll", close);
    };
  }, [filterOpen]);

  // Bring a deep-linked tag (?tag=) into view inside the scrolling tag row.
  useEffect(() => {
    const row = tagRowRef.current;
    if (!row || !initialSelectedTagId) return;
    const active = row.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!active) return;
    row.scrollLeft = active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2;
  }, [initialSelectedTagId]);

  const loadPage = useCallback(async (cursor: number | null, replace: boolean) => {
    if (savedOnly && savedWorkIds.length === 0) {
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
      activeRequestKeyRef.current = null;
      requestIdRef.current += 1;
      setWorks([]);
      setTotal(0);
      setHasMore(false);
      setNextCursor(null);
      setIsLoading(false);
      setLoadFailure(null);
      return;
    }

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

    const requestKey = `${selectedSeriesSlug}?${params.toString()}|replace=${replace}`;
    if (activeRequestKeyRef.current === requestKey) return;

    requestAbortRef.current?.abort();
    const abortController = new AbortController();
    requestAbortRef.current = abortController;
    activeRequestKeyRef.current = requestKey;
    const requestId = ++requestIdRef.current;

    setIsLoading(true);
    setLoadFailure(null);

    try {
      const response = await fetch(
        `/api/works/${selectedSeriesSlug}/cards?${params.toString()}`,
        {
          credentials: "same-origin",
          signal: abortController.signal,
        }
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
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error(error);
      setLoadFailure({ cursor, replace });
    } finally {
      if (activeRequestKeyRef.current === requestKey) {
        activeRequestKeyRef.current = null;
      }
      if (requestAbortRef.current === abortController) {
        requestAbortRef.current = null;
      }
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
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
      activeRequestKeyRef.current = null;
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

  useEffect(() => () => requestAbortRef.current?.abort(), []);

  const displayedWorks = savedOnly ? works.filter((work) => isSaved(work.id)) : works;

  const pillClass = (active: boolean) =>
    cn(
      "btn-press inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
      active
        ? "bg-foreground text-background"
        : "bg-foreground/[0.06] text-foreground hover:bg-foreground/10"
    );
  const tagClass = (active: boolean) =>
    cn(
      "btn-press relative shrink-0 whitespace-nowrap py-3 text-[15px] font-medium transition-colors",
      "after:absolute after:inset-x-0 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-foreground after:transition-opacity",
      active
        ? "text-foreground after:opacity-100"
        : "text-foreground/60 after:opacity-0 hover:text-foreground"
    );
  // "n / total" only while a filter is active; otherwise just the live count.
  const isFiltered =
    savedOnly || wallpaperOnly || selectedTagId !== null || selectedRange !== null;

  return (
    <div data-gallery-root data-gallery-total={total}>
      {/* Pinterest-style toolbar: sticks under the header and moves with the
          scroll — pushed up when scrolling down, pulled back when scrolling up. */}
      <div
        ref={toolbarRef}
        data-gallery-toolbar
        className="sticky top-14 z-40 -mx-3 bg-background will-change-transform data-[scrolled]:shadow-[0_6px_12px_-10px_rgb(0_0_0/0.35)] sm:-mx-5"
      >
        <div
          ref={filterRowRef}
          className="flex items-center gap-2 overflow-x-auto px-3 pt-3 pb-1 sm:px-5"
        >
          <GallerySeriesSelect
            series={series}
            selectedSlug={selectedSeriesSlug}
            variant="pill"
          />
          <SortToggle sort={sort} onSortChange={setSort} />
          <button
            type="button"
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly((prev) => !prev)}
            className={pillClass(savedOnly)}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
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
          {selectedSeriesSlug !== "recommend" && (
          <button
            type="button"
            aria-pressed={wallpaperOnly}
            onClick={() => setWallpaperOnly((prev) => !prev)}
            className={pillClass(wallpaperOnly)}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="7" y="2.5" width="10" height="19" rx="2" />
              <path strokeLinecap="round" d="M11 18.5h2" />
            </svg>
            {t.wallpaper}
          </button>
          )}
          {ranges.length > 0 && (
            <div className="shrink-0" ref={filterRef}>
              <button
                ref={filterButtonRef}
                type="button"
                aria-expanded={filterOpen}
                aria-haspopup="true"
                aria-label="Filter works by range"
                onClick={() => setFilterOpen((prev) => !prev)}
                className={pillClass(selectedRange !== null)}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
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
                {selectedRange ? `No. ${selectedRange.label}` : t.filter}
              </button>
            </div>
          )}
          <span aria-hidden="true" className="w-1 shrink-0" />
        </div>

        {tagFilters.length > 0 && (
          <div
            ref={tagRowRef}
            role="group"
            aria-label={t.tags}
            className="flex items-center gap-6 overflow-x-auto px-3 sm:px-5"
          >
            <button
              type="button"
              aria-pressed={selectedTagId === null}
              onClick={() => setSelectedTagId(null)}
              className={tagClass(selectedTagId === null)}
            >
              {t.all}
            </button>
            {tagFilters.map((tag) => (
              <button
                key={tag.id}
                type="button"
                title={`${tag.label} (${tag.count})`}
                onClick={() =>
                  setSelectedTagId((current) =>
                    current === tag.id ? null : tag.id
                  )
                }
                aria-pressed={selectedTagId === tag.id}
                className={tagClass(selectedTagId === tag.id)}
              >
                {tag.label}
              </button>
            ))}
            <span aria-hidden="true" className="w-1 shrink-0" />
          </div>
        )}
      </div>

      {filterOpen &&
        filterMenuPos &&
        createPortal(
          <div
            ref={filterMenuRef}
            style={{ top: filterMenuPos.top, left: filterMenuPos.left }}
            className="dropdown-enter fixed z-50 w-52 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedRange(null);
                setFilterOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover",
                !selectedRange && "font-semibold"
              )}
            >
              {t.allWorks}
            </button>
            {ranges.map((range) => (
              <button
                key={range.id}
                type="button"
                onClick={() => {
                  setSelectedRange(range);
                  setFilterOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover",
                  selectedRange?.id === range.id && "font-semibold"
                )}
              >
                No. {range.label}
              </button>
            ))}
          </div>,
          document.body
        )}

      {/* Compact summary — scrolls away with the page. */}
      <div className="mb-4 mt-3 flex flex-wrap items-baseline gap-x-2 text-sm">
        <h1 className="font-semibold text-foreground">Works</h1>
        <span aria-hidden="true" className="text-muted">·</span>
        <h2 className="text-muted">{seriesName}</h2>
        <span aria-hidden="true" className="text-muted">·</span>
        <p className="tabular-nums text-muted">
          {isFiltered ? `${total} / ${filterMeta.total}` : total} works
        </p>
      </div>

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
