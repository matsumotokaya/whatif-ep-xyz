import type { CanvasElement, TextElement, ShapeElement, ImageElement } from '../types/template';

// Pure command layer for the canvas document. Each Command describes one
// mutation intent; applyCommand turns it into a brand-new elements array
// without mutating the input array or any input element object. This is what
// lets useHistory store raw array references in its undo/redo stacks instead
// of deep-cloning on every push (structural sharing).
export type Command =
  | { type: 'updateElement'; id: string; updates: Partial<CanvasElement> }
  | { type: 'updateElements'; ids: string[]; updateFn: (element: CanvasElement) => Partial<CanvasElement> }
  | { type: 'deleteElements'; ids: string[] }
  | { type: 'addElement'; element: CanvasElement }
  | { type: 'bringToFront'; ids: string[] }
  | { type: 'sendToBack'; ids: string[] }
  | { type: 'reorderElements'; elements: CanvasElement[] };

function applyUpdateElement(elements: CanvasElement[], id: string, updates: Partial<CanvasElement>): CanvasElement[] {
  return elements.map((el) => {
    if (el.id !== id) return el;
    // Type-safe merge based on element type (mirrors the original
    // useElementOperations.updateElement branching exactly, including the
    // "as X" casts for TS narrowing).
    if (el.type === 'text' && updates.type === 'text') {
      return { ...el, ...updates } as TextElement;
    } else if (el.type === 'shape' && updates.type === 'shape') {
      return { ...el, ...updates } as ShapeElement;
    } else if (el.type === 'image' && updates.type === 'image') {
      return { ...el, ...updates } as ImageElement;
    } else {
      // For updates without a type change
      return { ...el, ...updates } as CanvasElement;
    }
  });
}

function applyUpdateElements(
  elements: CanvasElement[],
  ids: string[],
  updateFn: (element: CanvasElement) => Partial<CanvasElement>
): CanvasElement[] {
  return elements.map((el) => {
    if (!ids.includes(el.id)) return el;
    const updates = updateFn(el);
    return { ...el, ...updates } as CanvasElement;
  });
}

function applyDeleteElements(elements: CanvasElement[], ids: string[]): CanvasElement[] {
  return elements.filter((el) => !ids.includes(el.id));
}

function applyAddElement(elements: CanvasElement[], element: CanvasElement): CanvasElement[] {
  return [...elements, element];
}

function applyBringToFront(elements: CanvasElement[], ids: string[]): CanvasElement[] {
  const selectedElements = ids
    .map((id) => elements.find((el) => el.id === id))
    .filter((el): el is CanvasElement => el !== undefined);
  const remainingElements = elements.filter((el) => !ids.includes(el.id));
  return [...remainingElements, ...selectedElements];
}

function applySendToBack(elements: CanvasElement[], ids: string[]): CanvasElement[] {
  const selectedElements = ids
    .map((id) => elements.find((el) => el.id === id))
    .filter((el): el is CanvasElement => el !== undefined);
  const remainingElements = elements.filter((el) => !ids.includes(el.id));
  return [...selectedElements, ...remainingElements];
}

function applyReorderElements(newOrder: CanvasElement[]): CanvasElement[] {
  return newOrder;
}

// Pure reducer: elements + command -> new elements array. Never mutates
// `elements` or any of its items in place.
export function applyCommand(elements: CanvasElement[], command: Command): CanvasElement[] {
  switch (command.type) {
    case 'updateElement':
      return applyUpdateElement(elements, command.id, command.updates);
    case 'updateElements':
      return applyUpdateElements(elements, command.ids, command.updateFn);
    case 'deleteElements':
      return applyDeleteElements(elements, command.ids);
    case 'addElement':
      return applyAddElement(elements, command.element);
    case 'bringToFront':
      return applyBringToFront(elements, command.ids);
    case 'sendToBack':
      return applySendToBack(elements, command.ids);
    case 'reorderElements':
      return applyReorderElements(command.elements);
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}
