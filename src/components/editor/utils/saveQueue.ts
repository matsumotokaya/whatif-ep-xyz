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
//
// The executor and merge functions are injected, so the owner supplies BOTH
// "how to perform a save" and "how to merge two pending requests".

export interface SaveQueueOptions<TRequest, TResult> {
  execute: (request: TRequest, revision: number) => Promise<TResult>;
  merge: (previous: TRequest, incoming: TRequest) => TRequest;
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
  private drainResolvers: Array<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];
  private drainError: unknown = null;

  constructor(options: SaveQueueOptions<TRequest, TResult>) {
    this.execute = options.execute;
    this.merge = options.merge;
    this.onError = options.onError;
  }

  get isBusy(): boolean {
    return this.inFlight || this.pending !== null;
  }

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

  flush(): Promise<void> {
    if (!this.inFlight && !this.pending) {
      return Promise.resolve();
    }

    if (!this.inFlight && this.pending) {
      void this.drain();
    }

    return new Promise<void>((resolve, reject) => {
      this.drainResolvers.push({ resolve, reject });
    });
  }

  private async drain(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;

    try {
      while (this.pending) {
        const { request, revision } = this.pending;
        this.pending = null;

        try {
          await this.execute(request, revision);
        } catch (error) {
          this.drainError ??= error;
          this.onError?.(error, request, revision);
        }
      }
    } finally {
      this.inFlight = false;
      const resolvers = this.drainResolvers;
      this.drainResolvers = [];
      const error = this.drainError;
      this.drainError = null;
      resolvers.forEach(({ resolve, reject }) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    }
  }
}
