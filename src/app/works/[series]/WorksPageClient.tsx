"use client";

import { useEffect, useRef, useState } from "react";
import type { GallerySeries, WorkListItem } from "@/lib/types";
import { GallerySeriesSelect } from "@/components/GallerySeriesSelect";
import { SortToggle } from "@/components/SortToggle";
import { WorkGallery } from "@/components/WorkGallery";

const ITEMS_PER_PAGE = 20;

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

export function WorksPageClient({
  series,
  selectedSeriesSlug,
  works,
  total,
}: WorksPageClientProps) {
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<WorkRange | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const ranges = buildWorkRanges(works);
  // works arrives newest-first; reverse a copy for oldest sort (no extra server fetch).
  const sortedWorks = sort === "newest" ? works : [...works].reverse();
  const filteredWorks = selectedRange
    ? sortedWorks.filter(
        (work) =>
          work.sequenceNumber >= selectedRange.start &&
          work.sequenceNumber <= selectedRange.end
      )
    : sortedWorks;
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <GallerySeriesSelect series={series} selectedSlug={selectedSeriesSlug} />
          <SortToggle sort={sort} onSortChange={setSort} />
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
        <p className="text-xs tabular-nums text-muted">
          {filteredTotal} shown
          {selectedRange ? ` / ${total}` : ""}
        </p>
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
          key={`${selectedSeriesSlug}-${sort}-${selectedRange?.id ?? "all"}`}
          initialWorks={initialWorks}
          allWorks={filteredWorks}
          total={filteredTotal}
        />
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
