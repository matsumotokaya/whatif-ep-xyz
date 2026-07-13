// Pure helpers for the Stories fullscreen text editor (E2-c).
//
// Everything here is DOM-free so it can be unit-tested: the S/M/L <->
// fontSize mapping, the on-screen preview size, the visualViewport box used
// to keep the editor above the soft keyboard, and the centered placement
// math for newly added text.

export type StoryTextSizeKey = 'S' | 'M' | 'L';

// Canvas-unit font sizes for the three-step size control. Derived from the
// editor's default text size (80): S ~= 0.7x, M = 1.0x, L ~= 1.6x, rounded
// to multiples of 5.
export const STORY_TEXT_SIZES: Record<StoryTextSizeKey, number> = {
  S: 55,
  M: 80,
  L: 130,
};

export const STORY_TEXT_SIZE_KEYS: readonly StoryTextSizeKey[] = ['S', 'M', 'L'];

export function fontSizeForSizeKey(key: StoryTextSizeKey): number {
  return STORY_TEXT_SIZES[key];
}

// Nearest bucket for an arbitrary fontSize — used to highlight the active
// chip when opening an existing text element. Ties round up (S/M midpoint
// resolves to M, M/L midpoint to L).
export function nearestSizeKey(fontSize: number): StoryTextSizeKey {
  if (!Number.isFinite(fontSize)) return 'M';
  let best: StoryTextSizeKey = 'S';
  let bestDistance = Infinity;
  for (const key of STORY_TEXT_SIZE_KEYS) {
    const distance = Math.abs(STORY_TEXT_SIZES[key] - fontSize);
    if (distance <= bestDistance) {
      best = key;
      bestDistance = distance;
    }
  }
  return best;
}

// On-screen preview size (CSS px) for the overlay textarea. Canvas font
// sizes are in canvas units (way too large on a phone screen), so preview at
// a fixed ratio, clamped to stay readable and to keep L from overflowing.
export const PREVIEW_FONT_SCALE = 0.4;
export const PREVIEW_FONT_MIN_PX = 16;
export const PREVIEW_FONT_MAX_PX = 64;

export function previewFontSizePx(fontSize: number): number {
  if (!Number.isFinite(fontSize) || fontSize <= 0) return PREVIEW_FONT_MIN_PX;
  const px = Math.round(fontSize * PREVIEW_FONT_SCALE);
  return Math.min(PREVIEW_FONT_MAX_PX, Math.max(PREVIEW_FONT_MIN_PX, px));
}

// The rectangle (relative to the layout viewport) that is actually visible
// when the soft keyboard is open. The overlay is position:fixed, which iOS
// Safari keeps anchored to the LAYOUT viewport even while the visual
// viewport shrinks/scrolls for the keyboard — so the overlay must be offset
// by visualViewport.offsetTop and sized to visualViewport.height to stay
// fully on screen with its tool row just above the keyboard.
export interface ViewportBox {
  top: number;
  height: number;
}

export function getViewportBox(
  visualViewport: { height: number; offsetTop: number } | null | undefined,
  fallbackHeight: number
): ViewportBox {
  const fallback = Number.isFinite(fallbackHeight) && fallbackHeight > 0 ? fallbackHeight : 0;
  if (!visualViewport) return { top: 0, height: fallback };
  const height =
    Number.isFinite(visualViewport.height) && visualViewport.height > 0
      ? visualViewport.height
      : fallback;
  const top = Number.isFinite(visualViewport.offsetTop)
    ? Math.max(0, visualViewport.offsetTop)
    : 0;
  return { top, height };
}

// Size (canvas units) of a multi-line text block. Line measurement is
// injected so the caller can use canvas 2D metrics while tests use a fake.
export function estimateTextBlockSize(
  text: string,
  fontSize: number,
  lineHeight: number,
  measureLine: (line: string) => number
): { width: number; height: number } {
  const lines = text.split('\n');
  let width = 0;
  for (const line of lines) {
    const lineWidth = measureLine(line);
    if (Number.isFinite(lineWidth) && lineWidth > width) width = lineWidth;
  }
  const effectiveLineHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1;
  return { width, height: lines.length * fontSize * effectiveLineHeight };
}

// Top-left position that centers a block on the artboard.
export function centeredPlacement(
  canvasWidth: number,
  canvasHeight: number,
  blockWidth: number,
  blockHeight: number
): { x: number; y: number } {
  return {
    x: (canvasWidth - blockWidth) / 2,
    y: (canvasHeight - blockHeight) / 2,
  };
}
