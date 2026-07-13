import type Konva from 'konva';
import type { CanvasElement, TextElement, ShapeElement, ImageElement } from '../types/template';

// Consolidated "Konva node -> React state" commit logic (E1c).
//
// Every place that reads back a Konva node's position/scale/rotation and
// turns it into `Partial<CanvasElement>` updates (drag end, transform end,
// group transform end) goes through this module. The module is split in two
// layers:
//
//   1. A thin read layer (`readNodeTransform` / `resetNodeScale`) that talks
//      to the Konva node. This is the ONLY part touching Konva.
//   2. Pure builder functions that convert plain snapshot values into the
//      updates objects passed to `applyCommand` / the element update
//      callbacks. These are fully unit-testable.
//
// Behavioral invariants (do not change):
//   - Scale is always folded into width/height (or fontSize for text) and
//     never persisted on the element.
//   - Star/Circle nodes are center-origin in Konva while elements store
//     top-left coordinates; conversions live here.
//   - Minimum sizes: 5px for shape/image dimensions, 10 for text fontSize.

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Delta {
  dx: number;
  dy: number;
}

// Plain snapshot of everything a commit may need from a Konva node.
export interface NodeTransformSnapshot {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  width: number;
  height: number;
}

// Subset of the snapshot consumed by the transform-commit builders.
export interface TransformCommitInput {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export const MIN_ELEMENT_SIZE = 5;
export const MIN_TEXT_FONT_SIZE = 10;

// ---------------------------------------------------------------------------
// Read layer (the only Konva-touching part)
// ---------------------------------------------------------------------------

export function readNodeTransform(node: Konva.Node): NodeTransformSnapshot {
  return {
    x: node.x(),
    y: node.y(),
    scaleX: node.scaleX(),
    scaleY: node.scaleY(),
    rotation: node.rotation(),
    width: node.width(),
    height: node.height(),
  };
}

// Reset node scale after reading it, so the folded width/height coming back
// through React props is not scaled twice.
export function resetNodeScale(node: Konva.Node): void {
  node.scaleX(1);
  node.scaleY(1);
}

// ---------------------------------------------------------------------------
// Pure coordinate conversions
// ---------------------------------------------------------------------------

// Star/Circle Konva nodes use their center as the origin; elements store
// top-left coordinates.
export function isCenterOriginShape(shapeType: ShapeElement['shapeType']): boolean {
  return shapeType === 'star' || shapeType === 'circle';
}

export function isCenterOriginElement(element: CanvasElement): boolean {
  return element.type === 'shape' && isCenterOriginShape(element.shapeType);
}

export function centerToTopLeft(center: Position, size: Size): Position {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
  };
}

export function topLeftToCenter(topLeft: Position, size: Size): Position {
  return {
    x: topLeft.x + size.width / 2,
    y: topLeft.y + size.height / 2,
  };
}

// Node position -> element (top-left) position. `size` lets callers supply
// sanitized dimensions; it defaults to the element's own width/height.
export function nodePositionToElementPosition(
  element: CanvasElement,
  nodePos: Position,
  size?: Size
): Position {
  if (!isCenterOriginElement(element)) {
    return { x: nodePos.x, y: nodePos.y };
  }
  const shape = element as ShapeElement;
  return centerToTopLeft(nodePos, size ?? { width: shape.width, height: shape.height });
}

// Element (top-left) position -> node position. Inverse of the above, used
// when writing positions back onto Konva nodes during multi-drag.
export function elementPositionToNodePosition(
  element: CanvasElement,
  elementPos: Position,
  size?: Size
): Position {
  if (!isCenterOriginElement(element)) {
    return { x: elementPos.x, y: elementPos.y };
  }
  const shape = element as ShapeElement;
  return topLeftToCenter(elementPos, size ?? { width: shape.width, height: shape.height });
}

// ---------------------------------------------------------------------------
// Drag commit builders (pure)
// ---------------------------------------------------------------------------

// Delta of a multi-drag lead element from its start position, with the
// shift-key axis lock applied.
export function buildMultiDragDelta(
  committedPos: Position,
  startPos: Position,
  lockAxis: 'x' | 'y' | null
): Delta {
  let dx = committedPos.x - startPos.x;
  let dy = committedPos.y - startPos.y;
  if (lockAxis === 'x') {
    dx = 0;
  } else if (lockAxis === 'y') {
    dy = 0;
  }
  return { dx, dy };
}

// Position updates for a follower element offset by the lead's delta.
export function offsetPosition(pos: Position, delta: Delta): Position {
  return {
    x: pos.x + delta.dx,
    y: pos.y + delta.dy,
  };
}

// ---------------------------------------------------------------------------
// Transform commit builders (pure)
// ---------------------------------------------------------------------------

// Text: fold vertical scale into fontSize (Transformer uses keepRatio for
// text so scaleY is the uniform factor).
export function buildTextTransformUpdates(
  fontSize: number,
  t: TransformCommitInput
): Partial<TextElement> {
  return {
    x: t.x,
    y: t.y,
    fontSize: Math.max(MIN_TEXT_FONT_SIZE, fontSize * t.scaleY),
    rotation: t.rotation,
  };
}

// Shape: fold scale into width/height; convert center-origin node position
// (star/circle) back to a top-left element position using the NEW size.
export function buildShapeTransformUpdates(
  size: Size,
  isCenterOrigin: boolean,
  t: TransformCommitInput
): Partial<ShapeElement> {
  const newWidth = Math.max(MIN_ELEMENT_SIZE, size.width * t.scaleX);
  const newHeight = Math.max(MIN_ELEMENT_SIZE, size.height * t.scaleY);
  const pos = isCenterOrigin
    ? centerToTopLeft({ x: t.x, y: t.y }, { width: newWidth, height: newHeight })
    : { x: t.x, y: t.y };
  return {
    x: pos.x,
    y: pos.y,
    width: newWidth,
    height: newHeight,
    rotation: t.rotation,
  };
}

// Image: fold scale into width/height.
export function buildImageTransformUpdates(
  size: Size,
  t: TransformCommitInput
): Partial<ImageElement> {
  return {
    x: t.x,
    y: t.y,
    width: Math.max(MIN_ELEMENT_SIZE, size.width * t.scaleX),
    height: Math.max(MIN_ELEMENT_SIZE, size.height * t.scaleY),
    rotation: t.rotation,
  };
}

// Dispatcher used by the group Transformer commit: sizes come from the
// element state (not the node), matching the original group-transform code.
export function buildTransformUpdates(
  element: CanvasElement,
  t: TransformCommitInput
): Partial<CanvasElement> {
  if (element.type === 'text') {
    return buildTextTransformUpdates(element.fontSize, t);
  }
  if (element.type === 'shape') {
    return buildShapeTransformUpdates(
      { width: element.width, height: element.height },
      isCenterOriginShape(element.shapeType),
      t
    );
  }
  if (element.type === 'image') {
    return buildImageTransformUpdates({ width: element.width, height: element.height }, t);
  }
  return {};
}
