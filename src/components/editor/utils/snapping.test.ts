import { describe, it, expect } from 'vitest';
import { computeSnap, unionBox, type Box } from './snapping';

const canvas = { width: 1000, height: 800 };
const box = (x: number, y: number, width = 100, height = 100): Box => ({ x, y, width, height });

describe('computeSnap', () => {
  it('does not move a box that is not near any line', () => {
    const result = computeSnap(box(213, 337), [], canvas, { threshold: 5 });
    expect(result).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('snaps the box center to the artboard center on both axes', () => {
    // Center is at (497, 398); artboard center is (500, 400).
    const result = computeSnap(box(447, 348), [], canvas, { threshold: 5 });
    expect(result.dx).toBe(3);
    expect(result.dy).toBe(2);
    expect(result.guides).toContainEqual({ orientation: 'vertical', position: 500, start: 0, end: 800 });
    expect(result.guides).toContainEqual({ orientation: 'horizontal', position: 400, start: 0, end: 1000 });
  });

  it('snaps edges to the artboard edges', () => {
    const left = computeSnap(box(3, 300), [], canvas, { threshold: 5 });
    expect(left.dx).toBe(-3);
    expect(left.guides).toContainEqual({ orientation: 'vertical', position: 0, start: 0, end: 800 });

    const right = computeSnap(box(896, 300), [], canvas, { threshold: 5 });
    expect(right.dx).toBe(4);
    expect(right.guides).toContainEqual({ orientation: 'vertical', position: 1000, start: 0, end: 800 });
  });

  it('picks the nearest line when several are within the threshold', () => {
    // Left edge is 4 from x=200 (target left); right edge is 1 from x=305 (target right).
    const result = computeSnap(box(204, 600), [box(200, 100, 105, 50)], canvas, { threshold: 10 });
    expect(result.dx).toBe(1);
  });

  it('snaps to another element and spans the guide across both boxes', () => {
    const target = box(600, 100, 200, 50);
    // Moving left edge at 597 -> target left edge 600.
    const result = computeSnap(box(597, 500, 80, 120), [target], canvas, { threshold: 5 });
    expect(result.dx).toBe(3);
    expect(result.guides).toContainEqual({ orientation: 'vertical', position: 600, start: 100, end: 620 });
  });

  it('snaps the center of the moving box to the center of another element', () => {
    const target = box(100, 100, 300, 60); // center y = 130
    const result = computeSnap(box(600, 82, 100, 100), [target], canvas, { threshold: 5 });
    expect(result.dy).toBe(-2);
    expect(result.guides).toContainEqual({ orientation: 'horizontal', position: 130, start: 100, end: 700 });
  });

  it('reports every line the snapped box ends up aligned with', () => {
    // Same size as the target and nearly the same x: left, center and right all align.
    const target = box(300, 100, 100, 100);
    const result = computeSnap(box(301, 500, 100, 100), [target], canvas, { threshold: 5 });
    const vertical = result.guides.filter((guide) => guide.orientation === 'vertical').map((guide) => guide.position);
    expect(result.dx).toBe(-1);
    expect(vertical.sort((a, b) => a - b)).toEqual([300, 350, 400]);
  });

  it('shows a guide for a box that is already aligned without moving it', () => {
    const result = computeSnap(box(450, 213), [], canvas, { threshold: 5 });
    expect(result.dx).toBe(0);
    expect(result.guides).toContainEqual({ orientation: 'vertical', position: 500, start: 0, end: 800 });
  });

  it('leaves a locked axis alone', () => {
    const result = computeSnap(box(447, 348), [], canvas, { threshold: 5, lockX: true });
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(2);
    expect(result.guides.every((guide) => guide.orientation === 'horizontal')).toBe(true);
  });

  it('never snaps further than the threshold', () => {
    const result = computeSnap(box(7, 7), [], canvas, { threshold: 6 });
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
  });

  it('merges guides that share a position into one line', () => {
    const targets = [box(600, 0, 50, 50), box(600, 700, 50, 50)];
    const result = computeSnap(box(598, 350, 80, 80), targets, canvas, { threshold: 5 });
    const atLeft = result.guides.filter((guide) => guide.orientation === 'vertical' && guide.position === 600);
    expect(atLeft).toEqual([{ orientation: 'vertical', position: 600, start: 0, end: 750 }]);
  });
});

describe('unionBox', () => {
  it('returns null for no boxes', () => {
    expect(unionBox([])).toBeNull();
  });

  it('returns the smallest box containing all inputs', () => {
    expect(unionBox([box(10, 20, 30, 40), box(100, 5, 10, 10)])).toEqual({ x: 10, y: 5, width: 100, height: 55 });
  });
});
