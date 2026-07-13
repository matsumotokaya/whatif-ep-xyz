import type { Position, Size, TransformCommitInput } from './konvaCommit';

// Pure geometry for the Stories mode gestures (E2-b):
//
//   - Two-finger pinch/twist on the selected element (scale + rotate + move).
//   - Center snap guides while dragging an element with one finger.
//   - Trash-zone hit testing for drag-to-delete.
//
// Everything here is a pure function so the gesture math is unit-testable.
// The Konva/DOM glue lives in Canvas.tsx and only feeds plain values in.

export interface TouchPoint {
  x: number;
  y: number;
}

export type TouchPair = [TouchPoint, TouchPoint];

// Result of comparing the current two-finger positions against the pair
// captured at gesture start. All values are deltas relative to the start:
// `scale` is the distance ratio, `rotation` the signed angle change in
// degrees, `dx`/`dy` the midpoint translation in the input (screen px) space.
export interface PinchDelta {
  scale: number;
  rotation: number;
  dx: number;
  dy: number;
}

// Transient flags that gate Stories-mode element interaction while a
// two-finger gesture is in flight. Kept as a plain shape so the reset
// invariant can be unit-tested without any DOM/Konva glue.
export interface PinchFlags {
  isPinching: boolean;
  hadPinchGesture: boolean;
}

// Authoritative reconciliation of the pinch flags after a touchend/touchcancel,
// derived solely from how many touches are still down. The window receives
// these events for EVERY touch regardless of where it lands, so this is the
// reset of record: a pinch needs >= 2 active touches, and zero touches means no
// gesture is in flight at all.
//
// Without this, `isPinching` could latch true forever: e.g. two fingers press
// the canvas (Stage sets isPinching) with no valid single-element pinch session,
// then lift OFF the small canvas area — the Stage-level touchend never fires and
// the session-based window handler would early-return, leaving isPinching stuck
// and blocking all element selection/drag. Feeding the true remaining-touch
// count through here guarantees the flags always relax back to a usable state.
export function reconcilePinchFlagsOnTouchEnd(
  prev: PinchFlags,
  activeTouchCount: number,
): PinchFlags {
  return {
    isPinching: prev.isPinching && activeTouchCount >= 2,
    hadPinchGesture: activeTouchCount === 0 ? false : prev.hadPinchGesture,
  };
}

// Rotation snapping: 0/90/180/270 (any multiple of 90) within this tolerance.
export const ROTATION_SNAP_TOLERANCE_DEG = 5;

// Center snap distance while dragging, in screen px (converted to canvas
// units by the caller via the current stage scale).
export const CENTER_SNAP_SCREEN_PX = 8;

// Extra hit slop around the trash zone rect, in screen px.
export const TRASH_HIT_INFLATE_PX = 12;

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

function normalizeDeltaDeg(deg: number): number {
  // Normalize to (-180, 180] so a twist never jumps the long way around.
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function getPinchDelta(start: TouchPair, current: TouchPair): PinchDelta {
  const startVec = { x: start[1].x - start[0].x, y: start[1].y - start[0].y };
  const currentVec = { x: current[1].x - current[0].x, y: current[1].y - current[0].y };

  const startDist = Math.hypot(startVec.x, startVec.y);
  const currentDist = Math.hypot(currentVec.x, currentVec.y);
  // Degenerate start (both fingers on the same point): no meaningful ratio.
  const scale = startDist > 0.0001 ? currentDist / startDist : 1;

  const rotation = normalizeDeltaDeg(
    (Math.atan2(currentVec.y, currentVec.x) - Math.atan2(startVec.y, startVec.x)) * RAD_TO_DEG
  );

  const startMid = { x: (start[0].x + start[1].x) / 2, y: (start[0].y + start[1].y) / 2 };
  const currentMid = { x: (current[0].x + current[1].x) / 2, y: (current[0].y + current[1].y) / 2 };

  return {
    scale,
    rotation,
    dx: currentMid.x - startMid.x,
    dy: currentMid.y - startMid.y,
  };
}

// Snap an absolute rotation (degrees, any range) to the nearest multiple of
// 90 when within tolerance; otherwise return it unchanged.
export function snapRotationDeg(
  deg: number,
  tolerance: number = ROTATION_SNAP_TOLERANCE_DEG
): number {
  // `|| 0` normalizes the -0 that Math.round produces for small negatives.
  const nearest = Math.round(deg / 90) * 90 || 0;
  return Math.abs(deg - nearest) <= tolerance ? nearest : deg;
}

function rotateVector(v: Position, deg: number): Position {
  const rad = deg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

// Plain snapshot of the target node at pinch start. `nodeX`/`nodeY` are the
// Konva node coordinates (center for star/circle, top-left otherwise),
// `width`/`height` the unscaled node dimensions — all in canvas units.
export interface PinchStartSnapshot {
  nodeX: number;
  nodeY: number;
  width: number;
  height: number;
  rotation: number;
  isCenterOrigin: boolean;
}

// Convert a pinch delta into the TransformCommitInput consumed by the shared
// konvaCommit builders. The transform scales and rotates the element about
// its own center (Instagram behavior) and moves it by the finger-midpoint
// translation. `canvasPerScreen` converts screen px to canvas units
// (1 / stage scale).
export function buildPinchTransformInput(
  start: PinchStartSnapshot,
  delta: PinchDelta,
  canvasPerScreen: number,
  rotationSnapTolerance: number = ROTATION_SNAP_TOLERANCE_DEG
): TransformCommitInput {
  const scale = delta.scale;
  const rotation = snapRotationDeg(start.rotation + delta.rotation, rotationSnapTolerance);

  // Element center at gesture start, in canvas units. For top-left origin
  // nodes the center is offset by the rotated half-size vector.
  const startCenter = start.isCenterOrigin
    ? { x: start.nodeX, y: start.nodeY }
    : (() => {
        const half = rotateVector({ x: start.width / 2, y: start.height / 2 }, start.rotation);
        return { x: start.nodeX + half.x, y: start.nodeY + half.y };
      })();

  const center = {
    x: startCenter.x + delta.dx * canvasPerScreen,
    y: startCenter.y + delta.dy * canvasPerScreen,
  };

  // New node position keeps the (moved) center fixed under the new scale and
  // rotation. Center-origin nodes sit directly on the center.
  const pos = start.isCenterOrigin
    ? center
    : (() => {
        const half = rotateVector(
          { x: (start.width * scale) / 2, y: (start.height * scale) / 2 },
          rotation
        );
        return { x: center.x - half.x, y: center.y - half.y };
      })();

  return { x: pos.x, y: pos.y, scaleX: scale, scaleY: scale, rotation };
}

export interface CenterSnapResult {
  // Correction to add to the node position so the element center lands
  // exactly on the canvas center axis (0 when not snapping).
  dx: number;
  dy: number;
  snappedX: boolean;
  snappedY: boolean;
}

// Snap the element's bounding-box center to the canvas center axes when it
// is within `threshold` (canvas units). X and Y snap independently.
export function getCenterSnap(
  center: Position,
  canvasSize: Size,
  threshold: number
): CenterSnapResult {
  const dxToCenter = canvasSize.width / 2 - center.x;
  const dyToCenter = canvasSize.height / 2 - center.y;
  const snappedX = Math.abs(dxToCenter) <= threshold;
  const snappedY = Math.abs(dyToCenter) <= threshold;
  return {
    dx: snappedX ? dxToCenter : 0,
    dy: snappedY ? dyToCenter : 0,
    snappedX,
    snappedY,
  };
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function isPointInRect(point: TouchPoint, rect: RectLike, inflate = 0): boolean {
  return (
    point.x >= rect.left - inflate &&
    point.x <= rect.right + inflate &&
    point.y >= rect.top - inflate &&
    point.y <= rect.bottom + inflate
  );
}
