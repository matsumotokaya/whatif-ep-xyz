export default function EpisodesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="h-9 w-48 animate-pulse rounded bg-surface" />
        <div className="mt-2 h-5 w-24 animate-pulse rounded bg-surface" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface">
            <div className="aspect-square animate-pulse bg-surface-hover" />
            <div className="p-3">
              <div className="h-3 w-12 animate-pulse rounded bg-surface-hover" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-surface-hover" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
