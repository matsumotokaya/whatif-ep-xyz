// A generic, single-flight save queue.
//
// Guarantees:
// - At most one async operation runs at a time (strict serialization). New
//   requests that arrive while one is in flight never start a second run.
// - Requests that pile up while a run is in flight are coalesced into ONE
//   pending request via a caller-supplied `merge` function, so callers can OR
//   together flags (e.g. `generateThumbnail`) and a lower-priority coalesced
//   request can never silently drop a higher-priority one that was waiting.
// - Every enqueue is stamped with a monotonically increasing revision number.
//   Strict serialization already makes out-of-order application structurally
//   near-impossible, but the revision is tracked/exposed and passed to the
//   executor so stale results can be defensively ignored.
//
// The executor and merge functions are injected, so the owner supplies BOTH
// "how to perform a save" (which must read live state at execution time, e.g.
// via refs, NOT capture state at enqueue time) and "how to merge two pending
// requests".

export interface SaveQueueOptions<TRequest, TResult> {
  // Performs the actual save. Receives the (possibly merged) request and its
  // revision. Implementations should read the latest live state at call time
  // rather than relying on values captured when the request was enqueued.
  execute: (request: TRequest, revision: number) => Promise<TResult>;
  // Merges a currently-pending request with a newly-arrived one. Must be
  // order-independent enough that priority flags are preserved (OR them
  // together); the merged request replaces the pending one.
  merge: (previous: TRequest, incoming: TRequest) => TRequest;
  // Optional hook invoked when the executor rejects. Errors are swallowed by
  // the queue itself (so one failed run never wedges the queue) — surface them
  // here if the caller needs to react.
  onError?: (error: unknown, request: TRequest, revision: number) => void;
}

interface PendingEntry<TRequest> {
  request: TRequest;
  revision: number;
}

export class SaveQueue<TRequest, TResult = unknown> {
  private readonly execute: (request: TRequest, revision: number) => Promise<TResult>;
  private readonly merge: (previous: TRequest, incoming: TRequest) => TRequest;
  private readonly onError?: (error: unknown, request: TRequest, revision: number) => void;

  private inFlight = false;
  private pending: PendingEntry<TRequest> | null = null;
  private revisionCounter = 0;
  // Highest revision whose execution has completed. Purely defensive
  // bookkeeping: with strict serialization completions are already ordered.
  private lastCompletedRevision = 0;
  // Resolvers for callers awaiting a full drain via flush().
  private drainResolvers: Array<() => void> = [];

  constructor(options: SaveQueueOptions<TRequest, TResult>) {
    this.execute = options.execute;
    this.merge = options.merge;
    this.onError = options.onError;
  }

  // True while a run is in flight or a request is waiting to run.
  get isBusy(): boolean {
    return this.inFlight || this.pending !== null;
  }

  // Revision assigned to the most recent enqueue.
  get currentRevision(): number {
    return this.revisionCounter;
  }

  // Schedule a save. If one is already in flight, coalesce into the single
  // pending slot via `merge`. Returns the revision assigned to this enqueue.
  enqueue(request: TRequest): number {
    const revision = ++this.revisionCounter;

    if (this.pending) {
      this.pending = {
        request: this.merge(this.pending.request, request),
        revision,
      };
    } else {
      this.pending = { request, revision };
    }

    if (!this.inFlight) {
      void this.drain();
    }

    return revision;
  }

  // Force any pending request to run now (without waiting for a debounce, which
  // lives outside this queue) and resolve once the queue is fully drained —
  // i.e. the current in-flight run AND any request coalesced during it have
  // completed. Resolves immediately if there is nothing to do.
  flush(): Promise<void> {
    if (!this.inFlight && !this.pending) {
      return Promise.resolve();
    }

    if (!this.inFlight && this.pending) {
      void this.drain();
    }

    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  private async drain(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;

    try {
      // The loop re-checks `pending` after every await, so any request
      // enqueued (and coalesced) during a run is picked up before we exit —
      // the queue never comes to rest with work still pending.
      while (this.pending) {
        const { request, revision } = this.pending;
        this.pending = null;

        try {
          await this.execute(request, revision);
          if (revision > this.lastCompletedRevision) {
            this.lastCompletedRevision = revision;
          }
        } catch (error) {
          this.onError?.(error, request, revision);
        }
      }
    } finally {
      this.inFlight = false;
      // Resolve drain waiters now that no work remains.
      const resolvers = this.drainResolvers;
      this.drainResolvers = [];
      resolvers.forEach((resolve) => resolve());
    }
  }
}
