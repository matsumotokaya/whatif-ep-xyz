export default function WorksLoading() {
  return (
    <div className="w-full px-3 pb-6 sm:px-5 sm:pb-8" aria-busy="true">
      <div className="flex gap-2 overflow-hidden pt-3 pb-1">
        {[28, 24, 24, 24, 24].map((width, index) => (
          <div
            key={index}
            className="h-9 shrink-0 animate-pulse rounded-full bg-surface-hover"
            style={{ width: `${width * 4}px` }}
          />
        ))}
      </div>
      <div className="flex gap-6 overflow-hidden py-3">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-5 w-16 shrink-0 animate-pulse rounded bg-surface-hover" />
        ))}
      </div>
      <div className="mb-4 mt-3 h-4 w-48 animate-pulse rounded bg-surface-hover" />
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
