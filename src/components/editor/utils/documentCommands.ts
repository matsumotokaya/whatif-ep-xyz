import type { CanvasElement, TextElement, ShapeElement, ImageElement } from '../types/template';

// Pure command layer for the canvas document. Each Command describes one
// mutation intent; applyCommand turns it into a brand-new elements array
// without mutating the input array or any input element object. This is what
// lets the undo history store raw array references instead of deep-cloning on
// every push (structural sharing).
export type Command =
  | { type: 'updateElement'; id: string; updates: Partial<CanvasElement> }
  | { type: 'updateElements'; ids: string[]; updateFn: (element: CanvasElement) => Partial<CanvasElement> }
  | { type: 'deleteElements'; ids: string[] }
  | { type: 'addElement'; element: CanvasElement }
  | { type: 'addElements'; elements: CanvasElement[] }
  // Insert directly below `beforeId` in z-order. Falls back to the top of the
  // stack when the anchor no longer exists.
  | { type: 'insertElementsBelow'; elements: CanvasElement[]; beforeId: string }
  | { type: 'bringToFront'; ids: string[] }
  | { type: 'sendToBack'; ids: string[] }
  | { type: 'bringForward'; ids: string[] }
  | { type: 'sendBackward'; ids: string[] }
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

function applyInsertElementsBelow(
  elements: CanvasElement[],
  inserted: CanvasElement[],
  beforeId: string
): CanvasElement[] {
  const anchorIndex = elements.findIndex((el) => el.id === beforeId);
  if (anchorIndex < 0) return [...elements, ...inserted];
  return [...elements.slice(0, anchorIndex), ...inserted, ...elements.slice(anchorIndex)];
}

// Front/back moves keep the selected elements' relative z-order: selecting the
// upper element first must not flip it below the lower one.
function applyBringToFront(elements: CanvasElement[], ids: string[]): CanvasElement[] {
  const selected = elements.filter((el) => ids.includes(el.id));
  const remaining = elements.filter((el) => !ids.includes(el.id));
  return [...remaining, ...selected];
}

function applySendToBack(elements: CanvasElement[], ids: string[]): CanvasElement[] {
  const selected = elements.filter((el) => ids.includes(el.id));
  const remaining = elements.filter((el) => !ids.includes(el.id));
  return [...selected, ...remaining];
}

// One step up: each selected element swaps with the nearest unselected element
// above it. Iterating from the top keeps a selected run moving as one block.
function applyBringForward(elements: CanvasElement[], ids: string[]): CanvasElement[] {
  const result = [...elements];
  for (let i = result.length - 2; i >= 0; i--) {
    if (ids.includes(result[i].id) && !ids.includes(result[i + 1].id)) {
      [result[i], result[i + 1]] = [result[i + 1], result[i]];
    }
  }
  return result;
}

function applySendBackward(elements: CanvasElement[], ids: string[]): CanvasElement[] {
  const result = [...elements];
  for (let i = 1; i < result.length; i++) {
    if (ids.includes(result[i].id) && !ids.includes(result[i - 1].id)) {
      [result[i], result[i - 1]] = [result[i - 1], result[i]];
    }
  }
  return result;
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
      return [...elements, command.element];
    case 'addElements':
      return [...elements, ...command.elements];
    case 'insertElementsBelow':
      return applyInsertElementsBelow(elements, command.elements, command.beforeId);
    case 'bringToFront':
      return applyBringToFront(elements, command.ids);
    case 'sendToBack':
      return applySendToBack(elements, command.ids);
    case 'bringForward':
      return applyBringForward(elements, command.ids);
    case 'sendBackward':
      return applySendBackward(elements, command.ids);
    case 'reorderElements':
      return command.elements;
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

function shallowEqualElement(a: CanvasElement, b: CanvasElement): boolean {
  if (a === b) return true;
  const aRecord = a as unknown as Record<string, unknown>;
  const bRecord = b as unknown as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  if (aKeys.length !== Object.keys(bRecord).length) return false;
  return aKeys.every((key) => Object.is(aRecord[key], bRecord[key]));
}

// Restore reference equality for everything a command left unchanged in value.
// Commands always allocate (map/spread), so "set x to the value it already
// has" would otherwise look like an edit: a redundant undo step, a redundant
// autosave and a re-render of that element. Returns `previous` itself when the
// whole document is unchanged.
export function reconcileElements(previous: CanvasElement[], next: CanvasElement[]): CanvasElement[] {
  if (previous === next) return previous;

  const previousById = new Map(previous.map((el) => [el.id, el]));
  let identical = previous.length === next.length;
  const reconciled = next.map((el, index) => {
    const before = previousById.get(el.id);
    const kept = before && shallowEqualElement(before, el) ? before : el;
    if (kept !== previous[index]) identical = false;
    return kept;
  });

  return identical ? previous : reconciled;
}
