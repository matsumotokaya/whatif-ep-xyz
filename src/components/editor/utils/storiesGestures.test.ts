import { describe, it, expect } from 'vitest';
import {
  getPinchDelta,
  snapRotationDeg,
  buildPinchTransformInput,
  getCenterSnap,
  isPointInRect,
  reconcilePinchFlagsOnTouchEnd,
  type TouchPair,
  type PinchStartSnapshot,
} from './storiesGestures';

describe('reconcilePinchFlagsOnTouchEnd', () => {
  it('releases a latched isPinching when the last fingers lift (no session)', () => {
    // The core stuck-selection bug: two fingers pressed the canvas with no
    // pinch session, then lifted off it. isPinching must relax to false so
    // element interaction is not blocked forever.
    const result = reconcilePinchFlagsOnTouchEnd(
      { isPinching: true, hadPinchGesture: true },
      0,
    );
    expect(result.isPinching).toBe(false);
    expect(result.hadPinchGesture).toBe(false);
  });

  it('clears isPinching when fewer than two touches remain', () => {
    const result = reconcilePinchFlagsOnTouchEnd(
      { isPinching: true, hadPinchGesture: true },
      1,
    );
    expect(result.isPinching).toBe(false);
    // A finger is still down, so the post-pinch guard flag stays until 0.
    expect(result.hadPinchGesture).toBe(true);
  });

  it('keeps isPinching while two or more touches are still down', () => {
    const result = reconcilePinchFlagsOnTouchEnd(
      { isPinching: true, hadPinchGesture: true },
      2,
    );
    expect(result.isPinching).toBe(true);
    expect(result.hadPinchGesture).toBe(true);
  });

  it('never turns isPinching on by itself', () => {
    const result = reconcilePinchFlagsOnTouchEnd(
      { isPinching: false, hadPinchGesture: false },
      3,
    );
    expect(result.isPinching).toBe(false);
    expect(result.hadPinchGesture).toBe(false);
  });
});

describe('getPinchDelta', () => {
  it('computes scale from the distance ratio (pure spread)', () => {
    const start: TouchPair = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];
    const current: TouchPair = [
      { x: 50, y: 100 },
      { x: 250, y: 100 },
    ];
    const delta = getPinchDelta(start, current);
    expect(delta.scale).toBeCloseTo(2);
    expect(delta.rotation).toBeCloseTo(0);
    expect(delta.dx).toBeCloseTo(0);
    expect(delta.dy).toBeCloseTo(0);
  });

  it('computes rotation from the angle between the finger vectors', () => {
    const start: TouchPair = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    // Second finger rotated 90 degrees counter-clockwise in screen space
    // (screen y grows downward, so +90 is a clockwise twist visually).
    const current: TouchPair = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ];
    const delta = getPinchDelta(start, current);
    expect(delta.rotation).toBeCloseTo(90);
    expect(delta.scale).toBeCloseTo(1);
  });

  it('normalizes the rotation delta to the short way around', () => {
    const start: TouchPair = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    // -170deg vs +190deg: must report -170.
    const rad = (190 * Math.PI) / 180;
    const current: TouchPair = [
      { x: 0, y: 0 },
      { x: 100 * Math.cos(rad), y: 100 * Math.sin(rad) },
    ];
    const delta = getPinchDelta(start, current);
    expect(delta.rotation).toBeCloseTo(-170);
  });

  it('computes the midpoint translation', () => {
    const start: TouchPair = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const current: TouchPair = [
      { x: 10, y: 20 },
      { x: 110, y: 20 },
    ];
    const delta = getPinchDelta(start, current);
    expect(delta.dx).toBeCloseTo(10);
    expect(delta.dy).toBeCloseTo(20);
    expect(delta.scale).toBeCloseTo(1);
    expect(delta.rotation).toBeCloseTo(0);
  });

  it('returns scale 1 for a degenerate start pair', () => {
    const start: TouchPair = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ];
    const current: TouchPair = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(getPinchDelta(start, current).scale).toBe(1);
  });
});

describe('snapRotationDeg', () => {
  it('snaps near multiples of 90 within the default 5deg tolerance', () => {
    expect(snapRotationDeg(3)).toBe(0);
    expect(snapRotationDeg(-4)).toBe(0);
    expect(snapRotationDeg(87)).toBe(90);
    expect(snapRotationDeg(184)).toBe(180);
    expect(snapRotationDeg(268)).toBe(270);
    expect(snapRotationDeg(-86)).toBe(-90);
    expect(snapRotationDeg(356)).toBe(360);
  });

  it('leaves angles outside the tolerance unchanged', () => {
    expect(snapRotationDeg(10)).toBe(10);
    expect(snapRotationDeg(96)).toBe(96);
    expect(snapRotationDeg(-45)).toBe(-45);
  });

  it('respects a custom tolerance', () => {
    expect(snapRotationDeg(80, 10)).toBe(90);
    expect(snapRotationDeg(80, 5)).toBe(80);
  });
});

describe('buildPinchTransformInput', () => {
  it('scales a center-origin node in place and applies the midpoint move', () => {
    const start: PinchStartSnapshot = {
      nodeX: 100,
      nodeY: 100,
      width: 50,
      height: 50,
      rotation: 0,
      isCenterOrigin: true,
    };
    // 10 screen px right at 0.5 stage scale = 20 canvas units.
    const input = buildPinchTransformInput(
      start,
      { scale: 2, rotation: 0, dx: 10, dy: 0 },
      2
    );
    expect(input.x).toBeCloseTo(120);
    expect(input.y).toBeCloseTo(100);
    expect(input.scaleX).toBeCloseTo(2);
    expect(input.scaleY).toBeCloseTo(2);
    expect(input.rotation).toBe(0);
  });

  it('scales a top-left origin node about its center', () => {
    const start: PinchStartSnapshot = {
      nodeX: 0,
      nodeY: 0,
      width: 100,
      height: 50,
      rotation: 0,
      isCenterOrigin: false,
    };
    const input = buildPinchTransformInput(
      start,
      { scale: 2, rotation: 0, dx: 0, dy: 0 },
      1
    );
    // Center stays at (50, 25); the doubled node's top-left moves to keep it.
    expect(input.x).toBeCloseTo(-50);
    expect(input.y).toBeCloseTo(-25);
    expect(input.scaleX).toBeCloseTo(2);
  });

  it('rotates a top-left origin node about its center with rotation snap', () => {
    const start: PinchStartSnapshot = {
      nodeX: 0,
      nodeY: 0,
      width: 100,
      height: 0,
      rotation: 0,
      isCenterOrigin: false,
    };
    // 88deg twist snaps to 90; center (50, 0) must not move.
    const input = buildPinchTransformInput(
      start,
      { scale: 1, rotation: 88, dx: 0, dy: 0 },
      1
    );
    expect(input.rotation).toBe(90);
    // pos = center - R(90) * (50, 0) = (50, 0) - (0, 50) = (50, -50)
    expect(input.x).toBeCloseTo(50);
    expect(input.y).toBeCloseTo(-50);
  });

  it('does not snap rotation outside the tolerance', () => {
    const start: PinchStartSnapshot = {
      nodeX: 10,
      nodeY: 10,
      width: 20,
      height: 20,
      rotation: 30,
      isCenterOrigin: true,
    };
    const input = buildPinchTransformInput(
      start,
      { scale: 1, rotation: 15, dx: 0, dy: 0 },
      1
    );
    expect(input.rotation).toBe(45);
  });

  it('keeps the start center for a rotated top-left node', () => {
    // Node already rotated 90deg: center = pos + R(90) * (w/2, h/2).
    const start: PinchStartSnapshot = {
      nodeX: 100,
      nodeY: 100,
      width: 40,
      height: 20,
      rotation: 90,
      isCenterOrigin: false,
    };
    // No gesture change at all -> same node position must come back.
    const input = buildPinchTransformInput(
      start,
      { scale: 1, rotation: 0, dx: 0, dy: 0 },
      1
    );
    expect(input.x).toBeCloseTo(100);
    expect(input.y).toBeCloseTo(100);
    expect(input.rotation).toBe(90);
  });
});

describe('getCenterSnap', () => {
  const canvas = { width: 1000, height: 500 };

  it('snaps both axes when the center is within the threshold', () => {
    const snap = getCenterSnap({ x: 495, y: 253 }, canvas, 8);
    expect(snap.snappedX).toBe(true);
    expect(snap.snappedY).toBe(true);
    expect(snap.dx).toBeCloseTo(5);
    expect(snap.dy).toBeCloseTo(-3);
  });

  it('snaps a single axis independently', () => {
    const snap = getCenterSnap({ x: 495, y: 100 }, canvas, 8);
    expect(snap.snappedX).toBe(true);
    expect(snap.snappedY).toBe(false);
    expect(snap.dx).toBeCloseTo(5);
    expect(snap.dy).toBe(0);
  });

  it('does not snap outside the threshold', () => {
    const snap = getCenterSnap({ x: 480, y: 100 }, canvas, 8);
    expect(snap.snappedX).toBe(false);
    expect(snap.snappedY).toBe(false);
    expect(snap.dx).toBe(0);
    expect(snap.dy).toBe(0);
  });
});

describe('isPointInRect', () => {
  const rect = { left: 100, top: 200, right: 160, bottom: 260 };

  it('detects points inside the rect', () => {
    expect(isPointInRect({ x: 130, y: 230 }, rect)).toBe(true);
    expect(isPointInRect({ x: 100, y: 200 }, rect)).toBe(true);
  });

  it('rejects points outside the rect', () => {
    expect(isPointInRect({ x: 90, y: 230 }, rect)).toBe(false);
    expect(isPointInRect({ x: 130, y: 270 }, rect)).toBe(false);
  });

  it('applies the inflate slop', () => {
    expect(isPointInRect({ x: 90, y: 230 }, rect, 12)).toBe(true);
    expect(isPointInRect({ x: 130, y: 270 }, rect, 12)).toBe(true);
    expect(isPointInRect({ x: 80, y: 230 }, rect, 12)).toBe(false);
  });
});
