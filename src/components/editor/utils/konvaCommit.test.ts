import { describe, it, expect } from 'vitest';
import {
  isCenterOriginShape,
  isCenterOriginElement,
  centerToTopLeft,
  topLeftToCenter,
  nodePositionToElementPosition,
  elementPositionToNodePosition,
  buildMultiDragDelta,
  offsetPosition,
  buildTextTransformUpdates,
  buildShapeTransformUpdates,
  buildImageTransformUpdates,
  buildTransformUpdates,
} from './konvaCommit';
import type { TextElement, ShapeElement, ImageElement } from '../types/template';

function makeText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'text-1',
    type: 'text',
    x: 0,
    y: 0,
    text: 'hello',
    fontSize: 40,
    fontFamily: 'Arial',
    letterSpacing: 0,
    fill: '#000000',
    fillEnabled: true,
    stroke: '#000000',
    strokeWidth: 2,
    strokeEnabled: false,
    fontWeight: 400,
    ...overrides,
  };
}

function makeShape(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: 'shape-1',
    type: 'shape',
    x: 10,
    y: 10,
    width: 100,
    height: 100,
    shapeType: 'rectangle',
    fill: '#ffffff',
    fillEnabled: true,
    stroke: '#000000',
    strokeWidth: 2,
    strokeEnabled: false,
    ...overrides,
  };
}

function makeImage(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: 'image-1',
    type: 'image',
    x: 5,
    y: 5,
    width: 200,
    height: 200,
    src: 'https://example.com/a.png',
    ...overrides,
  };
}

describe('isCenterOriginShape', () => {
  it('is true only for star and circle', () => {
    expect(isCenterOriginShape('star')).toBe(true);
    expect(isCenterOriginShape('circle')).toBe(true);
    expect(isCenterOriginShape('rectangle')).toBe(false);
    expect(isCenterOriginShape('triangle')).toBe(false);
    expect(isCenterOriginShape('heart')).toBe(false);
  });
});

describe('isCenterOriginElement', () => {
  it('is true for star/circle shapes only', () => {
    expect(isCenterOriginElement(makeShape({ shapeType: 'star' }))).toBe(true);
    expect(isCenterOriginElement(makeShape({ shapeType: 'circle' }))).toBe(true);
    expect(isCenterOriginElement(makeShape({ shapeType: 'rectangle' }))).toBe(false);
    expect(isCenterOriginElement(makeText())).toBe(false);
    expect(isCenterOriginElement(makeImage())).toBe(false);
  });
});

describe('coordinate conversions', () => {
  it('centerToTopLeft subtracts half the size', () => {
    expect(centerToTopLeft({ x: 100, y: 80 }, { width: 40, height: 20 })).toEqual({ x: 80, y: 70 });
  });

  it('topLeftToCenter adds half the size', () => {
    expect(topLeftToCenter({ x: 80, y: 70 }, { width: 40, height: 20 })).toEqual({ x: 100, y: 80 });
  });

  it('round-trips center -> top-left -> center', () => {
    const size = { width: 123, height: 45 };
    const center = { x: 17.5, y: -3.25 };
    expect(topLeftToCenter(centerToTopLeft(center, size), size)).toEqual(center);
  });
});

describe('nodePositionToElementPosition', () => {
  it('passes through for non-center-origin elements', () => {
    expect(nodePositionToElementPosition(makeText(), { x: 30, y: 40 })).toEqual({ x: 30, y: 40 });
    expect(nodePositionToElementPosition(makeImage(), { x: 30, y: 40 })).toEqual({ x: 30, y: 40 });
    expect(
      nodePositionToElementPosition(makeShape({ shapeType: 'rectangle' }), { x: 30, y: 40 })
    ).toEqual({ x: 30, y: 40 });
  });

  it('converts center to top-left for star/circle using element size', () => {
    const star = makeShape({ shapeType: 'star', width: 100, height: 60 });
    expect(nodePositionToElementPosition(star, { x: 200, y: 130 })).toEqual({ x: 150, y: 100 });
  });

  it('uses the explicit size override when provided', () => {
    const circle = makeShape({ shapeType: 'circle', width: 100, height: 100 });
    expect(
      nodePositionToElementPosition(circle, { x: 200, y: 130 }, { width: 20, height: 40 })
    ).toEqual({ x: 190, y: 110 });
  });
});

describe('elementPositionToNodePosition', () => {
  it('passes through for non-center-origin elements', () => {
    expect(elementPositionToNodePosition(makeImage(), { x: 30, y: 40 })).toEqual({ x: 30, y: 40 });
  });

  it('converts top-left to center for star/circle', () => {
    const circle = makeShape({ shapeType: 'circle', width: 100, height: 60 });
    expect(elementPositionToNodePosition(circle, { x: 150, y: 100 })).toEqual({ x: 200, y: 130 });
  });

  it('is the inverse of nodePositionToElementPosition', () => {
    const star = makeShape({ shapeType: 'star', width: 77, height: 33 });
    const nodePos = { x: 12.5, y: -8 };
    expect(elementPositionToNodePosition(star, nodePositionToElementPosition(star, nodePos))).toEqual(nodePos);
  });
});

describe('buildMultiDragDelta', () => {
  it('returns the raw delta when no axis lock is active', () => {
    expect(buildMultiDragDelta({ x: 110, y: 95 }, { x: 100, y: 100 }, null)).toEqual({ dx: 10, dy: -5 });
  });

  it('zeroes dx when the x axis is locked', () => {
    expect(buildMultiDragDelta({ x: 110, y: 95 }, { x: 100, y: 100 }, 'x')).toEqual({ dx: 0, dy: -5 });
  });

  it('zeroes dy when the y axis is locked', () => {
    expect(buildMultiDragDelta({ x: 110, y: 95 }, { x: 100, y: 100 }, 'y')).toEqual({ dx: 10, dy: 0 });
  });
});

describe('offsetPosition', () => {
  it('offsets a position by a delta', () => {
    expect(offsetPosition({ x: 10, y: 20 }, { dx: -3, dy: 7 })).toEqual({ x: 7, y: 27 });
  });
});

describe('buildTextTransformUpdates', () => {
  it('folds scaleY into fontSize and keeps position/rotation', () => {
    const updates = buildTextTransformUpdates(40, { x: 5, y: 6, scaleX: 2, scaleY: 1.5, rotation: 30 });
    expect(updates).toEqual({ x: 5, y: 6, fontSize: 60, rotation: 30 });
  });

  it('clamps fontSize to the minimum of 10', () => {
    const updates = buildTextTransformUpdates(40, { x: 0, y: 0, scaleX: 0.1, scaleY: 0.1, rotation: 0 });
    expect(updates.fontSize).toBe(10);
  });
});

describe('buildShapeTransformUpdates', () => {
  it('folds scale into width/height for corner-origin shapes', () => {
    const updates = buildShapeTransformUpdates(
      { width: 100, height: 50 },
      false,
      { x: 10, y: 20, scaleX: 2, scaleY: 0.5, rotation: 45 }
    );
    expect(updates).toEqual({ x: 10, y: 20, width: 200, height: 25, rotation: 45 });
  });

  it('converts center-origin position using the NEW size for star/circle', () => {
    const updates = buildShapeTransformUpdates(
      { width: 100, height: 100 },
      true,
      { x: 200, y: 200, scaleX: 2, scaleY: 2, rotation: 0 }
    );
    // New size 200x200; node position is the center, so top-left = 200 - 100
    expect(updates).toEqual({ x: 100, y: 100, width: 200, height: 200, rotation: 0 });
  });

  it('clamps width/height to the minimum of 5', () => {
    const updates = buildShapeTransformUpdates(
      { width: 100, height: 100 },
      false,
      { x: 0, y: 0, scaleX: 0.01, scaleY: 0.01, rotation: 0 }
    );
    expect(updates.width).toBe(5);
    expect(updates.height).toBe(5);
  });
});

describe('buildImageTransformUpdates', () => {
  it('folds scale into width/height and keeps position/rotation', () => {
    const updates = buildImageTransformUpdates(
      { width: 200, height: 100 },
      { x: 1, y: 2, scaleX: 0.5, scaleY: 3, rotation: 90 }
    );
    expect(updates).toEqual({ x: 1, y: 2, width: 100, height: 300, rotation: 90 });
  });

  it('clamps width/height to the minimum of 5', () => {
    const updates = buildImageTransformUpdates(
      { width: 200, height: 100 },
      { x: 0, y: 0, scaleX: 0.001, scaleY: 0.001, rotation: 0 }
    );
    expect(updates.width).toBe(5);
    expect(updates.height).toBe(5);
  });
});

describe('buildTransformUpdates (dispatcher)', () => {
  const t = { x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 15 };

  it('dispatches text elements to the text builder', () => {
    const text = makeText({ fontSize: 30 });
    expect(buildTransformUpdates(text, t)).toEqual(buildTextTransformUpdates(30, t));
  });

  it('dispatches corner-origin shapes with element size', () => {
    const rect = makeShape({ shapeType: 'rectangle', width: 100, height: 50 });
    expect(buildTransformUpdates(rect, t)).toEqual(
      buildShapeTransformUpdates({ width: 100, height: 50 }, false, t)
    );
  });

  it('dispatches star/circle shapes as center-origin', () => {
    const star = makeShape({ shapeType: 'star', width: 100, height: 100 });
    expect(buildTransformUpdates(star, t)).toEqual(
      buildShapeTransformUpdates({ width: 100, height: 100 }, true, t)
    );
    expect(buildTransformUpdates(star, t)).toEqual({
      x: 10 - 100,
      y: 20 - 100,
      width: 200,
      height: 200,
      rotation: 15,
    });
  });

  it('dispatches image elements with element size (not node size)', () => {
    const image = makeImage({ width: 200, height: 100 });
    expect(buildTransformUpdates(image, t)).toEqual(
      buildImageTransformUpdates({ width: 200, height: 100 }, t)
    );
  });
});
