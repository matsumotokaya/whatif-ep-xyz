export default function WorksLoading() {
  return (
    <div className="w-full px-3 py-6 sm:px-5 sm:py-8" aria-busy="true">
      <div className="mb-8 space-y-2">
        <div className="h-8 w-28 animate-pulse rounded bg-surface-hover" />
        <div className="h-4 w-44 animate-pulse rounded bg-surface-hover" />
      </div>
      <div className="mb-6 flex gap-2">
        <div className="h-9 w-28 animate-pulse rounded-lg bg-surface-hover" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-surface-hover" />
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5">
        {Array.from({ length: 15 }, (_, index) => (
          <div
            key={index}
            className="aspect-[4/5] animate-pulse rounded-xl bg-surface-hover"
          />
        ))}
      </div>
    </div>
  );
}
