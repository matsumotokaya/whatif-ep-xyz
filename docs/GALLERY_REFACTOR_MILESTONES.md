# Gallery refactor milestones

## Goal

Make gallery sorting reliable and make page loading scale with the requested
page size instead of the total catalog size.

## Milestones

1. **Gallery reliability — complete**
   - Keep cards visible when sorting replaces a page with the same item count.
   - Preserve the current list when a page request fails.
   - Show an inline retry action for failed sort, filter, and pagination requests.

2. **List-image normalization — complete**
   - Publishing a Content Factory project attempts to create a lightweight
     `feed_thumb`.
   - Backfill immutable Gallery-only WebP files for works that do not have a
     `feed_thumb`, without changing production project or wallpaper state.
   - Prefer a future real `feed_thumb`, then the normalized Gallery thumbnail,
     and retain legacy images only as a last-resort error fallback.
   - 2026-07-21 backfill: 402 missing thumbnails created, 0 failures. The
     generated files total 22.8 MB and use immutable one-year cache headers.
   - Measured 20-card payloads after normalization: oldest first page 1.16 MB,
     oldest second page 1.02 MB, newest first page 0.66 MB, and newest second
     page 0.67 MB.

3. **True server pagination — complete**
   - Introduce a list-specific read model with only card fields.
   - Sort and filter in the database and return a bounded cursor page.
   - Clamp page size and return `nextCursor`/`hasMore`.
   - The service-role-only `get_gallery_work_cards_page` RPC selects at most
     51 rows and enriches only the requested page; the public API returns at
     most 50 cards and caches non-user-specific queries in the Next.js Data
     Cache and at the CDN edge. Saved-ID queries bypass both shared caches.
   - The browser and Gallery thumbnail backfill both advance by the last
     `sequence_number`, so inserts or removals do not shift later pages.
   - 2026-07-21 local production-build verification: five consecutive oldest
     20-card API pages completed in 35–38 ms with no overlaps. Newest, oldest,
     range, tag, wallpaper, saved-ID, empty-ID, and page-size-clamp cases passed.

4. **Delivery and long-scroll performance — complete**
   - Add immutable CDN caching for versioned list images.
   - Avoid touch-scroll detail prefetch contention.
   - Bound off-screen rendering with page chunks, `content-visibility`, or
     windowing based on profiling.
   - Gallery fallback thumbnails use the immutable `gallery-thumbs/v1` path;
     fixed-name Content Factory `feed_thumb` objects deliberately remain
     non-immutable because publishing can overwrite them.
   - Card rendering is split into memoized 60-item chunks (divisible by every
     3/4/5-column layout), and only the initial 20 cards run entrance animation.
     Detail prefetch is disabled in the scrolling grid.
   - The next bounded cursor page starts 600 px before the sentinel. Repeated
     request keys are ignored and superseded filter/sort requests are aborted;
     image downloads remain browser-lazy.
   - `content-visibility` was tested at card and chunk level, then rejected: it
     reduced layout time but increased cumulative style recalculation for the
     actual continuous-scroll workload.
   - 2026-07-21 cache-disabled mobile Chrome comparison, all 469 cards: layout
     526→327 ms, style recalculation 3,361→444 ms, script 983→396 ms, and total
     task time 8,833→5,235 ms. All 23 cursor pages were requested exactly once.
     Oldest 1–80 remained visible with no alert or touch-triggered detail fetch.

5. **Performance regression coverage — planned**
   - Add sort/filter visibility E2E coverage.
   - Add budgets for list-image bytes, endpoint latency, and long-scroll DOM size.
