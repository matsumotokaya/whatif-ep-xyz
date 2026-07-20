import { describe, expect, it, vi } from 'vitest';
import { createBannerSaveTrace, getSaveErrorCode } from './bannerSaveTelemetry';

describe('createBannerSaveTrace', () => {
  it('emits correlated, size-only structured events', () => {
    const sink = vi.fn();
    const clock = vi.fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(137);
    const trace = createBannerSaveTrace(
      {
        bannerId: 'banner-1',
        elementCount: 3,
        thumbnailBytes: 1200,
        fullresBytes: 8200,
      },
      { now: clock, saveId: 'save-1', sink },
    );

    trace.emit('document_committed', 'succeeded', { documentRevision: 4 });

    expect(sink).toHaveBeenCalledWith({
      event: 'banner_save',
      saveId: 'save-1',
      bannerId: 'banner-1',
      stage: 'document_committed',
      outcome: 'succeeded',
      elapsedMs: 37,
      documentRevision: 4,
      elementCount: 3,
      thumbnailBytes: 1200,
      fullresBytes: 8200,
    });
  });
});

describe('getSaveErrorCode', () => {
  it('prefers service codes and falls back to the Error name', () => {
    expect(getSaveErrorCode({ code: 'PGRST202' })).toBe('PGRST202');
    expect(getSaveErrorCode(new TypeError('network failed'))).toBe('TypeError');
  });
});
