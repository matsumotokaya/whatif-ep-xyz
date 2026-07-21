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

3. **True server pagination — planned**
   - Introduce a list-specific read model with only card fields.
   - Sort and filter in the database and return a bounded cursor page.
   - Clamp page size and return `nextCursor`/`hasMore`.

4. **Delivery and long-scroll performance — planned**
   - Add immutable CDN caching for versioned list images.
   - Avoid touch-scroll detail prefetch contention.
   - Bound off-screen rendering with page chunks, `content-visibility`, or
     windowing based on profiling.

5. **Performance regression coverage — planned**
   - Add sort/filter visibility E2E coverage.
   - Add budgets for list-image bytes, endpoint latency, and long-scroll DOM size.
