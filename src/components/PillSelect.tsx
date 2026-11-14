// Shared look for native <select> elements rendered as rounded pills in the
// gallery toolbar. Native selects keep keyboard/mobile pickers for free.
export const PILL_SELECT_CLASS =
  "btn-press h-9 cursor-pointer appearance-none rounded-full bg-foreground/[0.06] pl-4 pr-9 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10";

export function PillSelectChevron() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}
