export interface FitToCanvasPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getFitToCanvasPlacement(
  canvasWidth: number,
  canvasHeight: number,
  contentWidth: number,
  contentHeight: number,
): FitToCanvasPlacement {
  const hasValidDimensions = [canvasWidth, canvasHeight, contentWidth, contentHeight]
    .every((value) => Number.isFinite(value) && value > 0);
  if (!hasValidDimensions) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Cover the canvas while preserving the source aspect ratio. One axis may
  // extend beyond the canvas and is clipped by the artboard, but no empty
  // bands remain on either axis.
  const scale = Math.max(canvasWidth / contentWidth, canvasHeight / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;

  return {
    width,
    height,
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
  };
}
