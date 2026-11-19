import { computeFitScale } from '../stories/fitScale';

// Pure geometry for the Studio viewport: where the artboard sits inside the
// canvas area for a given zoom and pan. The Konva stage is always the size of
// that area, so zooming changes these numbers instead of the canvas bitmap.

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

// `scale` is the artboard scale (1 = 100%). The offset is the pan in CSS px
// away from the position where the artboard is centered in its container, so a
// container resize keeps a centered artboard centered.
export interface ViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const MIN_VIEW_SCALE = 0.05;
export const MAX_VIEW_SCALE = 5;

// Part of the artboard that must stay reachable when panning, in CSS px.
export const MIN_VISIBLE_ARTBOARD_PX = 64;

// Breathing room around the artboard for fit-to-screen, in CSS px.
export const FIT_PADDING_PX = 32;

// Per-event cap for wheel zoom. A mouse wheel notch (delta 100+) and a fast
// trackpad pinch both land on this step, so neither jumps several levels.
const MAX_WHEEL_ZOOM_DELTA = 20;
const WHEEL_ZOOM_SENSITIVITY = 0.01;
const WHEEL_LINE_HEIGHT_PX = 16;

const ZOOM_STEPS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];

export function clampViewScale(scale: number, fallback = 1): number {
  if (!Number.isFinite(scale) || scale <= 0) return fallback;
  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, scale));
}

// Container position of the artboard's top-left corner.
export function getArtboardOrigin(view: ViewState, container: Size, artboard: Size): Point {
  return {
    x: (container.width - artboard.width * view.scale) / 2 + view.offsetX,
    y: (container.height - artboard.height * view.scale) / 2 + view.offsetY,
  };
}

export function containerToCanvas(point: Point, view: ViewState, container: Size, artboard: Size): Point {
  const origin = getArtboardOrigin(view, container, artboard);
  return {
    x: (point.x - origin.x) / view.scale,
    y: (point.y - origin.y) / view.scale,
  };
}

// Keep part of the artboard inside the container so a pan or zoom can never
// leave the user looking at an empty canvas area.
export function constrainView(view: ViewState, container: Size, artboard: Size): ViewState {
  if (container.width <= 0 || container.height <= 0) return view;

  const constrainAxis = (offset: number, containerSize: number, artboardSize: number): number => {
    const scaledSize = artboardSize * view.scale;
    const visible = Math.min(MIN_VISIBLE_ARTBOARD_PX, scaledSize, containerSize);
    const centered = (containerSize - scaledSize) / 2;
    // origin = centered + offset must satisfy:
    //   origin + scaledSize >= visible   and   origin <= containerSize - visible
    const min = visible - scaledSize - centered;
    const max = containerSize - visible - centered;
    return Math.min(max, Math.max(min, offset));
  };

  const offsetX = constrainAxis(view.offsetX, container.width, artboard.width);
  const offsetY = constrainAxis(view.offsetY, container.height, artboard.height);
  if (offsetX === view.offsetX && offsetY === view.offsetY) return view;
  return { scale: view.scale, offsetX, offsetY };
}

// Zoom so that the canvas point under `anchor` (container coordinates) stays
// under it. This is what makes wheel and pinch zoom feel anchored to the
// pointer instead of to the artboard center.
export function zoomAtPoint(
  view: ViewState,
  container: Size,
  artboard: Size,
  anchor: Point,
  nextScale: number,
): ViewState {
  const scale = clampViewScale(nextScale, view.scale);
  if (scale === view.scale) return view;

  const canvasPoint = containerToCanvas(anchor, view, container, artboard);
  const centeredX = (container.width - artboard.width * scale) / 2;
  const centeredY = (container.height - artboard.height * scale) / 2;
  return constrainView(
    {
      scale,
      offsetX: anchor.x - canvasPoint.x * scale - centeredX,
      offsetY: anchor.y - canvasPoint.y * scale - centeredY,
    },
    container,
    artboard,
  );
}

export function zoomAtCenter(view: ViewState, container: Size, artboard: Size, nextScale: number): ViewState {
  return zoomAtPoint(view, container, artboard, { x: container.width / 2, y: container.height / 2 }, nextScale);
}

export function panBy(view: ViewState, container: Size, artboard: Size, dx: number, dy: number): ViewState {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return view;
  return constrainView(
    { scale: view.scale, offsetX: view.offsetX + dx, offsetY: view.offsetY + dy },
    container,
    artboard,
  );
}

// Whole artboard visible and centered.
export function fitView(container: Size, artboard: Size): ViewState {
  const fitScale = computeFitScale({
    containerWidth: container.width,
    containerHeight: container.height,
    canvasWidth: artboard.width,
    canvasHeight: artboard.height,
    padding: FIT_PADDING_PX,
  });
  return { scale: clampViewScale(fitScale), offsetX: 0, offsetY: 0 };
}

// Scale after one wheel event with Ctrl/Cmd held (also how browsers report a
// trackpad pinch). Exponential, so zooming in and back out returns to the
// start and the step feels the same at 10% and at 400%.
export function wheelZoomScale(scale: number, deltaY: number, deltaMode = 0): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return scale;
  const pixels = deltaMode === 1 ? deltaY * WHEEL_LINE_HEIGHT_PX : deltaY;
  const capped = Math.min(MAX_WHEEL_ZOOM_DELTA, Math.max(-MAX_WHEEL_ZOOM_DELTA, pixels));
  return clampViewScale(scale * Math.exp(-capped * WHEEL_ZOOM_SENSITIVITY), scale);
}

// Next preset level for the zoom buttons and keyboard shortcuts.
export function stepZoomScale(scale: number, direction: 1 | -1): number {
  const epsilon = 1e-6;
  if (direction > 0) {
    return ZOOM_STEPS.find((step) => step > scale + epsilon) ?? MAX_VIEW_SCALE;
  }
  return [...ZOOM_STEPS].reverse().find((step) => step < scale - epsilon) ?? MIN_VIEW_SCALE;
}

// The zoom slider is logarithmic: equal travel is an equal zoom ratio, so the
// useful 10%-200% range is not squeezed into one end of the track.
const LOG_SCALE_RANGE = Math.log(MAX_VIEW_SCALE / MIN_VIEW_SCALE);

export function scaleToSliderValue(scale: number): number {
  return Math.log(clampViewScale(scale) / MIN_VIEW_SCALE) / LOG_SCALE_RANGE;
}

// Lands on whole percentages, so the slider can reach exactly 100% and the
// zoom always equals what the readout shows.
export function sliderValueToScale(value: number): number {
  const ratio = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const scale = MIN_VIEW_SCALE * Math.exp(ratio * LOG_SCALE_RANGE);
  return clampViewScale(Math.round(scale * 100) / 100);
}

// True inside the artboard or the band of `bleed` canvas units around it. A
// drag that starts there on empty space is a marquee selection; further out it
// pans the view.
export function isInsideBleedZone(canvasPoint: Point, artboard: Size, bleed: number): boolean {
  return (
    canvasPoint.x >= -bleed
    && canvasPoint.y >= -bleed
    && canvasPoint.x <= artboard.width + bleed
    && canvasPoint.y <= artboard.height + bleed
  );
}
