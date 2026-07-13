import { describe, it, expect } from 'vitest';
import {
  STORY_TEXT_SIZES,
  STORY_TEXT_SIZE_KEYS,
  fontSizeForSizeKey,
  nearestSizeKey,
  previewFontSizePx,
  PREVIEW_FONT_MIN_PX,
  PREVIEW_FONT_MAX_PX,
  getViewportBox,
  estimateTextBlockSize,
  centeredPlacement,
} from './storiesTextTools';

describe('S/M/L <-> fontSize mapping', () => {
  it('maps every key to its bucket value', () => {
    for (const key of STORY_TEXT_SIZE_KEYS) {
      expect(fontSizeForSizeKey(key)).toBe(STORY_TEXT_SIZES[key]);
    }
  });

  it('round-trips: nearestSizeKey(fontSizeForSizeKey(k)) === k', () => {
    for (const key of STORY_TEXT_SIZE_KEYS) {
      expect(nearestSizeKey(fontSizeForSizeKey(key))).toBe(key);
    }
  });

  it('snaps arbitrary sizes to the nearest bucket', () => {
    expect(nearestSizeKey(20)).toBe('S');
    expect(nearestSizeKey(60)).toBe('S');
    expect(nearestSizeKey(75)).toBe('M');
    expect(nearestSizeKey(100)).toBe('M');
    expect(nearestSizeKey(120)).toBe('L');
    expect(nearestSizeKey(400)).toBe('L');
  });

  it('rounds ties up', () => {
    // Midpoints: (55+80)/2 = 67.5 -> M, (80+130)/2 = 105 -> L
    expect(nearestSizeKey(67.5)).toBe('M');
    expect(nearestSizeKey(105)).toBe('L');
  });

  it('falls back to M for non-finite input', () => {
    expect(nearestSizeKey(NaN)).toBe('M');
    expect(nearestSizeKey(Infinity)).toBe('M');
  });
});

describe('previewFontSizePx', () => {
  it('scales by the preview ratio and rounds', () => {
    expect(previewFontSizePx(80)).toBe(32);
    expect(previewFontSizePx(55)).toBe(22);
    expect(previewFontSizePx(130)).toBe(52);
  });

  it('clamps to the readable range', () => {
    expect(previewFontSizePx(10)).toBe(PREVIEW_FONT_MIN_PX);
    expect(previewFontSizePx(1000)).toBe(PREVIEW_FONT_MAX_PX);
  });

  it('falls back to the minimum for invalid input', () => {
    expect(previewFontSizePx(NaN)).toBe(PREVIEW_FONT_MIN_PX);
    expect(previewFontSizePx(0)).toBe(PREVIEW_FONT_MIN_PX);
    expect(previewFontSizePx(-5)).toBe(PREVIEW_FONT_MIN_PX);
  });
});

describe('getViewportBox', () => {
  it('uses visualViewport height and offsetTop when available', () => {
    expect(getViewportBox({ height: 400, offsetTop: 120 }, 800)).toEqual({
      top: 120,
      height: 400,
    });
  });

  it('falls back to window height when visualViewport is missing', () => {
    expect(getViewportBox(null, 800)).toEqual({ top: 0, height: 800 });
    expect(getViewportBox(undefined, 800)).toEqual({ top: 0, height: 800 });
  });

  it('guards against degenerate viewport values', () => {
    expect(getViewportBox({ height: 0, offsetTop: 10 }, 800)).toEqual({ top: 10, height: 800 });
    expect(getViewportBox({ height: NaN, offsetTop: NaN }, 800)).toEqual({ top: 0, height: 800 });
    expect(getViewportBox({ height: 500, offsetTop: -20 }, 800)).toEqual({ top: 0, height: 500 });
  });

  it('guards against a broken fallback height', () => {
    expect(getViewportBox(null, NaN)).toEqual({ top: 0, height: 0 });
    expect(getViewportBox({ height: NaN, offsetTop: 0 }, -1)).toEqual({ top: 0, height: 0 });
  });
});

describe('estimateTextBlockSize', () => {
  const measure = (line: string) => line.length * 10;

  it('uses the widest line and counts all lines', () => {
    const size = estimateTextBlockSize('ab\nabcd\nc', 80, 1, measure);
    expect(size.width).toBe(40);
    expect(size.height).toBe(3 * 80);
  });

  it('applies the line-height multiplier', () => {
    const size = estimateTextBlockSize('a\nb', 80, 1.5, measure);
    expect(size.height).toBe(2 * 80 * 1.5);
  });

  it('defaults an invalid line height to 1', () => {
    expect(estimateTextBlockSize('a', 80, NaN, measure).height).toBe(80);
    expect(estimateTextBlockSize('a', 80, 0, measure).height).toBe(80);
  });

  it('ignores non-finite measurements', () => {
    const size = estimateTextBlockSize('ab', 80, 1, () => NaN);
    expect(size.width).toBe(0);
  });
});

describe('centeredPlacement', () => {
  it('centers the block on the artboard', () => {
    expect(centeredPlacement(1000, 800, 200, 100)).toEqual({ x: 400, y: 350 });
  });

  it('allows negative positions for blocks larger than the artboard', () => {
    expect(centeredPlacement(100, 100, 300, 200)).toEqual({ x: -100, y: -50 });
  });
});
