import type Konva from 'konva';
import type { BaseElement } from '../../types/template';

export type ElementPointerEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent | Event>;
export type ElementDragEvent = Konva.KonvaEventObject<DragEvent>;

// Interaction callbacks every element node reports to the Canvas. The object
// identity is stable for the life of the Canvas, so renderers can be memoized
// on the element alone and still always reach current logic.
export interface ElementNodeHandlers {
  registerNode: (id: string, node: Konva.Node | null) => void;
  onPress: (id: string, event: ElementPointerEvent) => void;
  onClick: (id: string, event: ElementPointerEvent) => void;
  onDragStart: (id: string, event: ElementDragEvent) => void;
  onDragMove: (id: string, event: ElementDragEvent) => void;
  onDragEnd: (id: string, event: ElementDragEvent) => void;
  onTransformEnd: (id: string, event: Konva.KonvaEventObject<Event>) => void;
}

// Props shared by every element node: visibility, lock state and the event
// wiring. Locked or hidden elements neither listen nor drag.
export function elementNodeProps(element: BaseElement, handlers: ElementNodeHandlers) {
  const visible = element.visible ?? true;
  const interactive = !element.locked && visible;
  const { id } = element;
  return {
    visible,
    draggable: interactive,
    listening: interactive,
    onMouseDown: (event: ElementPointerEvent) => handlers.onPress(id, event),
    onTouchStart: (event: ElementPointerEvent) => handlers.onPress(id, event),
    onTap: (event: ElementPointerEvent) => handlers.onPress(id, event),
    onClick: (event: ElementPointerEvent) => handlers.onClick(id, event),
    onDragStart: (event: ElementDragEvent) => handlers.onDragStart(id, event),
    onDragMove: (event: ElementDragEvent) => handlers.onDragMove(id, event),
    onDragEnd: (event: ElementDragEvent) => handlers.onDragEnd(id, event),
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => handlers.onTransformEnd(id, event),
  };
}

// Shadow props with the editor's defaults for elements saved before a value
// was chosen.
export function elementShadowProps(element: BaseElement) {
  return {
    shadowEnabled: element.shadowEnabled ?? false,
    shadowColor: element.shadowColor ?? '#000000',
    shadowBlur: element.shadowBlur ?? 4,
    shadowOffsetX: element.shadowOffsetX ?? 2,
    shadowOffsetY: element.shadowOffsetY ?? 2,
    shadowOpacity: element.shadowOpacity ?? 0.5,
  };
}
