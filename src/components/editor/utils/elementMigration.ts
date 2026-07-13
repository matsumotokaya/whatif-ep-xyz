import type { CanvasElement, ShapeElement, TextElement, ImageElement } from '../types/template';

// Pure, idempotent normalization for CanvasElement documents loaded from the
// DB. Historically this ran inline inside a BannerEditor useEffect
// (banner.elements.map(...)); it has been extracted here unchanged so it can
// be unit tested and reused without dragging in component state.
//
// Behavior must stay byte-for-byte identical to the original inline
// implementation, including the legacy `strokeOnly` handling on text
// elements (kept via the `...text` spread rather than deleted).
export function migrateElements(elements: CanvasElement[]): CanvasElement[] {
  return elements.map((el) => {
    if (el.type === 'shape') {
      const shape = el as ShapeElement;
      return {
        ...shape,
        fillEnabled: shape.fillEnabled !== undefined ? shape.fillEnabled : true,
        stroke: shape.stroke || '#000000',
        strokeWidth: shape.strokeWidth || 2,
        strokeEnabled: shape.strokeEnabled !== undefined ? shape.strokeEnabled : false,
        visible: shape.visible ?? true,
        locked: shape.locked ?? false,
      } as ShapeElement;
    }
    if (el.type === 'text') {
      const text = el as TextElement;
      // Migrate old strokeOnly property to new structure
      const strokeOnly = (text as any).strokeOnly;
      return {
        ...text,
        fillEnabled: text.fillEnabled !== undefined ? text.fillEnabled : (strokeOnly === undefined ? true : !strokeOnly),
        stroke: text.stroke || text.fill || '#000000',
        strokeWidth: text.strokeWidth || Math.max(text.fontSize * 0.03, 2),
        strokeEnabled: text.strokeEnabled !== undefined ? text.strokeEnabled : (strokeOnly || false),
        letterSpacing: text.letterSpacing ?? 0,
        visible: text.visible ?? true,
        locked: text.locked ?? false,
      } as TextElement;
    }
    if (el.type === 'image') {
      const image = el as ImageElement;
      return {
        ...image,
        visible: image.visible ?? true,
        locked: image.locked ?? false,
      } as ImageElement;
    }
    return el;
  });
}
