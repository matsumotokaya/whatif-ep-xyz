export default function WorkDetailLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background" aria-busy="true">
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[58vh] animate-pulse bg-surface/50 lg:h-auto lg:min-h-0" />
        <aside className="border-t border-border p-6 lg:border-l lg:border-t-0">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-surface-hover" />
          <div className="mt-6 h-5 w-24 animate-pulse rounded bg-surface-hover" />
          <div className="mt-3 h-8 w-56 animate-pulse rounded bg-surface-hover" />
          <div className="mt-8 space-y-2">
            <div className="h-10 animate-pulse rounded-lg bg-surface-hover" />
            <div className="h-10 animate-pulse rounded-lg bg-surface-hover" />
            <div className="h-10 animate-pulse rounded-lg bg-surface-hover" />
          </div>
        </aside>
      </div>
    </div>
  );
}
