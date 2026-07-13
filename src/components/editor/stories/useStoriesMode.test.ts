import { describe, it, expect } from 'vitest';
import { isPhoneViewport, PHONE_MAX_SHORT_SIDE } from './useStoriesMode';

// Studio-vs-Stories is decided by input capability + physical size, not width
// alone. Stories is phone-only: touch AND a phone-sized shorter side.
describe('isPhoneViewport', () => {
  it('treats a portrait phone as a phone', () => {
    expect(isPhoneViewport({ pointerCoarse: true, width: 390, height: 844 })).toBe(true);
  });

  it('treats a landscape phone as a phone (shorter side decides)', () => {
    // Same device rotated: width/height swap, shorter side unchanged.
    expect(isPhoneViewport({ pointerCoarse: true, width: 844, height: 390 })).toBe(true);
  });

  it('treats a large phone as a phone', () => {
    // iPhone Pro Max-ish.
    expect(isPhoneViewport({ pointerCoarse: true, width: 430, height: 932 })).toBe(true);
  });

  it('treats a portrait tablet as NOT a phone (Studio)', () => {
    // iPad mini portrait: coarse pointer but shorter side 744 >= 600.
    expect(isPhoneViewport({ pointerCoarse: true, width: 744, height: 1133 })).toBe(false);
  });

  it('treats a landscape tablet as NOT a phone (Studio)', () => {
    expect(isPhoneViewport({ pointerCoarse: true, width: 1180, height: 820 })).toBe(false);
  });

  it('treats a touch laptop as NOT a phone (Studio)', () => {
    // Large touch screen with a coarse pointer available.
    expect(isPhoneViewport({ pointerCoarse: true, width: 1366, height: 768 })).toBe(false);
  });

  it('treats a mouse desktop as NOT a phone regardless of window size', () => {
    // Even a phone-sized window stays Studio when the pointer is fine (a mouse
    // cannot pinch, so Stories would be unusable).
    expect(isPhoneViewport({ pointerCoarse: false, width: 390, height: 844 })).toBe(false);
    expect(isPhoneViewport({ pointerCoarse: false, width: 1440, height: 900 })).toBe(false);
  });

  it('uses PHONE_MAX_SHORT_SIDE as an exclusive upper bound', () => {
    expect(isPhoneViewport({ pointerCoarse: true, width: PHONE_MAX_SHORT_SIDE - 1, height: 1000 })).toBe(true);
    expect(isPhoneViewport({ pointerCoarse: true, width: PHONE_MAX_SHORT_SIDE, height: 1000 })).toBe(false);
  });
});
