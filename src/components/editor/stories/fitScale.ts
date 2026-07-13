// Pure fit-to-screen scale computation for the Stories mode canvas.
//
// Stories mode always shows the whole artboard: no user zoom, no pan. The
// scale is derived from the available viewport area so the artboard (not the
// Konva Stage, which includes BLEED around the artboard) fits inside it.

// Lower bound protects Konva from degenerate scales when the container is
// briefly measured as tiny (e.g. mid-layout, keyboard animations).
export const MIN_FIT_SCALE = 0.01;

export interface FitScaleInput {
  containerWidth: number;
  containerHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  // Breathing room kept free on every side of the artboard, in CSS px.
  padding?: number;
}

export function computeFitScale({
  containerWidth,
  containerHeight,
  canvasWidth,
  canvasHeight,
  padding = 16,
}: FitScaleInput): number {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(containerHeight) ||
    !Number.isFinite(canvasWidth) ||
    !Number.isFinite(canvasHeight) ||
    canvasWidth <= 0 ||
    canvasHeight <= 0
  ) {
    return MIN_FIT_SCALE;
  }

  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;
  if (availableWidth <= 0 || availableHeight <= 0) {
    return MIN_FIT_SCALE;
  }

  const scale = Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight);
  return Math.max(scale, MIN_FIT_SCALE);
}
