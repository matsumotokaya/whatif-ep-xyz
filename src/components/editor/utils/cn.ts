// Minimal className combiner for the ported IMAGINE pages.
//
// The IMAGINE original used clsx + tailwind-merge, but the ported call sites
// only concatenate non-conflicting static class lists, so a simple
// filter-and-join avoids adding two dependencies. Callers that need to
// override a default class pass a replacement instead of relying on
// last-one-wins merge semantics (see SitePageLayout).
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
