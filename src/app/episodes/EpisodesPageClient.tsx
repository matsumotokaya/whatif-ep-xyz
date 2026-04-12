"use client";

import { useEffect, useRef, useState } from "react";
import type { Episode } from "@/lib/types";
import { EpisodeGallery } from "@/components/EpisodeGallery";
import { SortToggle } from "@/components/SortToggle";

const ITEMS_PER_PAGE = 20;

type EpisodeRange = {
  id: string;
  label: string;
  start: number;
  end: number;
};

interface EpisodesPageClientProps {
  newestFirst: Episode[];
  oldestFirst: Episode[];
  total: number;
}

function parseEpisodeNumber(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildEpisodeRanges(episodes: Episode[]): EpisodeRange[] {
  let max = 0;
  for (const episode of episodes) {
    const number = parseEpisodeNumber(episode.number);
    if (number && number > max) max = number;
  }

  const ranges: EpisodeRange[] = [];
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

export function EpisodesPageClient({
  newestFirst,
  oldestFirst,
  total,
}: EpisodesPageClientProps) {
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<EpisodeRange | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const ranges = buildEpisodeRanges(newestFirst);
  const sortedEpisodes = sort === "newest" ? newestFirst : oldestFirst;
  const filteredEpisodes = selectedRange
    ? sortedEpisodes.filter((episode) => {
        const number = parseEpisodeNumber(episode.number);
        if (!number) return false;
        return number >= selectedRange.start && number <= selectedRange.end;
      })
    : sortedEpisodes;
  const filteredTotal = filteredEpisodes.length;
  const initialEpisodes = filteredEpisodes.slice(0, ITEMS_PER_PAGE);

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
          <SortToggle sort={sort} onSortChange={setSort} />
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              aria-expanded={filterOpen}
              aria-label="Filter episodes by range"
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
                  All episodes
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
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6l12 12M18 6L6 18"
                />
              </svg>
            </button>
          </span>
          <button
            type="button"
            onClick={() => setSelectedRange(null)}
            className="btn-press rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      <EpisodeGallery
        key={`${sort}-${selectedRange?.id ?? "all"}`}
        initialEpisodes={initialEpisodes}
        allEpisodes={filteredEpisodes}
        total={filteredTotal}
      />
    </div>
  );
}
