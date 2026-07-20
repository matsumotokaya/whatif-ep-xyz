export type BannerSaveStage =
  | 'save_started'
  | 'document_committed'
  | 'preview_upload_started'
  | 'preview_upload_completed'
  | 'preview_finalized'
  | 'preview_rejected_as_stale'
  | 'preview_failed'
  | 'legacy_fallback'
  | 'save_completed';

export type BannerSaveOutcome = 'started' | 'succeeded' | 'failed' | 'stale' | 'fallback';

export interface BannerSaveEvent {
  event: 'banner_save';
  saveId: string;
  bannerId: string;
  stage: BannerSaveStage;
  outcome: BannerSaveOutcome;
  elapsedMs: number;
  documentRevision?: number;
  elementCount?: number;
  thumbnailBytes?: number;
  fullresBytes?: number;
  errorCode?: string;
}

type EventSink = (event: BannerSaveEvent) => void;

const defaultNow = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

const createSaveId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const defaultSink: EventSink = (event) => {
  const writer = event.outcome === 'failed' ? console.warn : console.info;
  writer('[banner-save]', event);
};

export function createBannerSaveTrace(
  params: {
    bannerId: string;
    elementCount?: number;
    thumbnailBytes?: number;
    fullresBytes?: number;
  },
  options: {
    now?: () => number;
    saveId?: string;
    sink?: EventSink;
  } = {},
) {
  const now = options.now ?? defaultNow;
  const sink = options.sink ?? defaultSink;
  const saveId = options.saveId ?? createSaveId();
  const startedAt = now();

  return {
    saveId,
    emit(
      stage: BannerSaveStage,
      outcome: BannerSaveOutcome,
      details: Pick<BannerSaveEvent, 'documentRevision' | 'errorCode'> = {},
    ): void {
      sink({
        event: 'banner_save',
        saveId,
        bannerId: params.bannerId,
        stage,
        outcome,
        elapsedMs: Math.max(0, Math.round(now() - startedAt)),
        elementCount: params.elementCount,
        thumbnailBytes: params.thumbnailBytes,
        fullresBytes: params.fullresBytes,
        ...details,
      });
    },
  };
}

export function getSaveErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return 'unknown';
}
