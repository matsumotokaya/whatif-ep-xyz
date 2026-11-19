// Pure smart-guide math for dragging in Studio: snap the moving bounding box to
// the artboard (edges and center) and to other elements (edges and centers),
// and report the guide lines to draw. The Konva glue lives in Canvas.tsx.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapGuide {
  // A vertical guide is the line x = position, drawn from y = start to y = end.
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

export interface SnapOptions {
  // Snap distance in canvas units (callers pass screen px / zoom).
  threshold: number;
  // Skip an axis that is constrained elsewhere (Shift axis lock).
  lockX?: boolean;
  lockY?: boolean;
}

// After snapping, an edge or center this close to a line counts as aligned with
// it and gets a guide (canvas units; absorbs floating point error).
const ALIGN_EPSILON = 0.01;

interface SnapLine {
  position: number;
  // Extent of the thing this line belongs to, across the other axis.
  start: number;
  end: number;
}

type Axis = 'x' | 'y';

const SIZE_KEY = { x: 'width', y: 'height' } as const;
const CROSS_AXIS = { x: 'y', y: 'x' } as const;

function anchorsOf(box: Box, axis: Axis): number[] {
  const start = box[axis];
  const size = box[SIZE_KEY[axis]];
  return [start, start + size / 2, start + size];
}

function linesOf(box: Box, axis: Axis): SnapLine[] {
  const cross = CROSS_AXIS[axis];
  const start = box[cross];
  const end = start + box[SIZE_KEY[cross]];
  return anchorsOf(box, axis).map((position) => ({ position, start, end }));
}

function bestOffset(moving: Box, lines: SnapLine[], axis: Axis, threshold: number): number | null {
  let best: number | null = null;
  for (const anchor of anchorsOf(moving, axis)) {
    for (const line of lines) {
      const distance = line.position - anchor;
      if (Math.abs(distance) > threshold) continue;
      if (best === null || Math.abs(distance) < Math.abs(best)) best = distance;
    }
  }
  return best;
}

function guidesFor(snapped: Box, lines: SnapLine[], axis: Axis): SnapGuide[] {
  const cross = CROSS_AXIS[axis];
  const movingStart = snapped[cross];
  const movingEnd = movingStart + snapped[SIZE_KEY[cross]];
  const merged = new Map<number, SnapGuide>();

  for (const anchor of anchorsOf(snapped, axis)) {
    for (const line of lines) {
      if (Math.abs(line.position - anchor) > ALIGN_EPSILON) continue;
      const start = Math.min(line.start, movingStart);
      const end = Math.max(line.end, movingEnd);
      const existing = merged.get(line.position);
      if (existing) {
        existing.start = Math.min(existing.start, start);
        existing.end = Math.max(existing.end, end);
      } else {
        merged.set(line.position, {
          orientation: axis === 'x' ? 'vertical' : 'horizontal',
          position: line.position,
          start,
          end,
        });
      }
    }
  }

  return [...merged.values()];
}

export function computeSnap(
  moving: Box,
  targets: Box[],
  canvas: { width: number; height: number },
  options: SnapOptions,
): SnapResult {
  const artboard: Box = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const sources = [artboard, ...targets];
  const xLines = sources.flatMap((box) => linesOf(box, 'x'));
  const yLines = sources.flatMap((box) => linesOf(box, 'y'));

  const dx = options.lockX ? null : bestOffset(moving, xLines, 'x', options.threshold);
  const dy = options.lockY ? null : bestOffset(moving, yLines, 'y', options.threshold);

  const snapped: Box = {
    x: moving.x + (dx ?? 0),
    y: moving.y + (dy ?? 0),
    width: moving.width,
    height: moving.height,
  };

  return {
    dx: dx ?? 0,
    dy: dy ?? 0,
    guides: [
      ...(dx === null ? [] : guidesFor(snapped, xLines, 'x')),
      ...(dy === null ? [] : guidesFor(snapped, yLines, 'y')),
    ],
  };
}

// Smallest box containing all the given boxes, or null for an empty list.
export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
