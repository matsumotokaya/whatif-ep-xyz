export default function EpisodesLoading() {
  return (
    <div className="w-full px-2 py-6 sm:px-4 sm:py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="h-9 w-40 animate-pulse rounded bg-surface" />
          <div className="mt-2 h-4 w-24 animate-pulse rounded bg-surface" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-lg border border-border bg-surface" />
      </div>

      <div className="mb-6 flex justify-end">
        <div className="h-9 w-32 animate-pulse rounded-lg border border-border bg-surface" />
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4 lg:grid-cols-5 md:gap-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            <div className="aspect-square animate-pulse bg-surface-hover" />
            <div className="p-2 sm:p-3">
              <div className="h-3 w-12 animate-pulse rounded bg-surface-hover" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-surface-hover" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
