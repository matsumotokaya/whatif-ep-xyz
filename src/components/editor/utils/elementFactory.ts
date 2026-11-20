import type { CanvasElement, ImageElement, ShapeElement, TextElement } from '../types/template';

// Builders for elements the user adds in the editor. Pure: ids come from the
// caller-supplied generator so tests stay deterministic.

export type ElementIdFactory = (type: CanvasElement['type']) => string;

export interface CanvasSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

// Sticky text settings: the last font/size/color the user worked with seeds
// the next text they add.
export interface TextDefaults {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  fill: string;
}

export const INITIAL_TEXT_DEFAULTS: TextDefaults = {
  fontFamily: 'Arial',
  fontSize: 80,
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: 1,
  fill: '#000000',
};

// A newly added image or shape never covers more than this share of the
// artboard, so its resize handles are always reachable.
const MAX_NEW_IMAGE_COVERAGE = 0.8;
const NEW_SHAPE_COVERAGE = 0.25;
const RECTANGLE_ASPECT = 4 / 3;

// Offset between stacked copies (paste, duplicate, repeated add), in canvas units.
export const CASCADE_OFFSET = 20;

export const createElementId: ElementIdFactory = (type) => `${type}-${crypto.randomUUID()}`;

export function createTextElement(
  id: string,
  text: string,
  position: Point,
  defaults: TextDefaults,
): TextElement {
  return {
    id,
    type: 'text',
    text,
    x: position.x,
    y: position.y,
    fontSize: defaults.fontSize,
    fontFamily: defaults.fontFamily,
    letterSpacing: defaults.letterSpacing,
    lineHeight: defaults.lineHeight,
    fill: defaults.fill,
    fillEnabled: true,
    stroke: '#000000',
    strokeWidth: 2,
    strokeEnabled: false,
    fontWeight: defaults.fontWeight,
    visible: true,
  };
}

// Move a new element diagonally until its corner is free, so adding the same
// thing twice does not hide the first one exactly underneath.
export function cascadePosition(position: Point, existing: CanvasElement[]): Point {
  let { x, y } = position;
  const isTaken = () => existing.some((el) => Math.abs(el.x - x) < 0.5 && Math.abs(el.y - y) < 0.5);
  while (isTaken()) {
    x += CASCADE_OFFSET;
    y += CASCADE_OFFSET;
  }
  return { x, y };
}

export function createShapeElement(
  id: string,
  shapeType: ShapeElement['shapeType'],
  canvas: CanvasSize,
  existing: CanvasElement[],
): ShapeElement {
  const side = Math.max(1, Math.round(Math.min(canvas.width, canvas.height) * NEW_SHAPE_COVERAGE));
  const width = shapeType === 'rectangle' ? Math.round(side * RECTANGLE_ASPECT) : side;
  const position = cascadePosition(
    { x: Math.round((canvas.width - width) / 2), y: Math.round((canvas.height - side) / 2) },
    existing,
  );
  return {
    id,
    type: 'shape',
    x: position.x,
    y: position.y,
    width,
    height: side,
    fill: '#000000',
    fillEnabled: true,
    stroke: '#000000',
    strokeWidth: 2,
    strokeEnabled: false,
    shapeType,
    visible: true,
  };
}

// Size for a newly added image: its natural size, scaled down (never up) to
// stay within MAX_NEW_IMAGE_COVERAGE of the artboard, aspect ratio preserved.
export function fitNewImageSize(naturalWidth: number, naturalHeight: number, canvas: CanvasSize): CanvasSize {
  const valid = [naturalWidth, naturalHeight, canvas.width, canvas.height]
    .every((value) => Number.isFinite(value) && value > 0);
  if (!valid) return { width: Math.max(1, naturalWidth || 1), height: Math.max(1, naturalHeight || 1) };

  const scale = Math.min(
    1,
    (canvas.width * MAX_NEW_IMAGE_COVERAGE) / naturalWidth,
    (canvas.height * MAX_NEW_IMAGE_COVERAGE) / naturalHeight,
  );
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

export function createImageElement(
  id: string,
  src: string,
  natural: CanvasSize,
  canvas: CanvasSize,
  existing: CanvasElement[],
  // Canvas point the image should be centered on (drop position). Defaults to
  // the artboard center.
  center?: Point,
): ImageElement {
  const size = fitNewImageSize(natural.width, natural.height, canvas);
  const target = center ?? { x: canvas.width / 2, y: canvas.height / 2 };
  const position = cascadePosition(
    { x: Math.round(target.x - size.width / 2), y: Math.round(target.y - size.height / 2) },
    existing,
  );
  return {
    id,
    type: 'image',
    x: position.x,
    y: position.y,
    src,
    width: size.width,
    height: size.height,
    visible: true,
  };
}

// A template's elements as the starting point of a new design: a deep copy
// with every element unlocked. A lock saved into a template (left on while
// the template was being made) must not reach the people who open it.
export function elementsFromTemplate(elements: readonly CanvasElement[] | null | undefined): CanvasElement[] {
  return (JSON.parse(JSON.stringify(elements ?? [])) as CanvasElement[]).map((element) => ({
    ...element,
    locked: false,
  }));
}

// Independent copies with fresh ids, shifted by `offset` on both axes. Copies
// are always unlocked: a pasted element the user cannot move is a trap.
export function cloneElements(
  elements: CanvasElement[],
  offset: number,
  createId: ElementIdFactory,
): CanvasElement[] {
  return elements.map((element) => ({
    ...element,
    id: createId(element.type),
    x: element.x + offset,
    y: element.y + offset,
    locked: false,
  }));
}
