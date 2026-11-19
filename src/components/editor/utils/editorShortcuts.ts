// Pure keyboard mapping for the Studio editor: which key press means which
// editor action, given where the keyboard focus is. Kept free of DOM listeners
// so every combination is unit-testable.

export type EditorShortcut =
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'save' }
  | { type: 'copy' }
  | { type: 'cut' }
  | { type: 'duplicate' }
  | { type: 'delete' }
  | { type: 'selectAll' }
  | { type: 'escape' }
  | { type: 'nudge'; dx: number; dy: number }
  | { type: 'bringForward' }
  | { type: 'sendBackward' }
  | { type: 'bringToFront' }
  | { type: 'sendToBack' }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'zoomFit' }
  | { type: 'zoomActual' };

export interface ShortcutKeyEvent {
  key: string;
  // Physical key, used where the produced character depends on the layout.
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}

// Where the keyboard focus is when the key arrives:
//  - 'text'    a field the user types into; the key belongs to that field
//  - 'control' a non-text control (slider, checkbox, button); it keeps the keys
//              it uses itself, everything else still drives the editor
//  - 'canvas'  anything else
export type ShortcutFocus = 'canvas' | 'control' | 'text';

const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;

const TEXT_INPUT_TYPES = new Set([
  'text', 'search', 'url', 'tel', 'email', 'password', 'number', 'date', 'datetime-local', 'month', 'time', 'week',
]);

interface FocusTarget {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

export function classifyShortcutFocus(target: FocusTarget | null | undefined): ShortcutFocus {
  if (!target || !target.tagName) return 'canvas';
  if (target.isContentEditable) return 'text';

  const tag = target.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return 'text';
  if (tag === 'INPUT') {
    return TEXT_INPUT_TYPES.has((target.type ?? 'text').toLowerCase()) ? 'text' : 'control';
  }
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return 'control';
  return 'canvas';
}

function arrowDelta(key: string, step: number): { dx: number; dy: number } | null {
  switch (key) {
    case 'ArrowUp':
      return { dx: 0, dy: -step };
    case 'ArrowDown':
      return { dx: 0, dy: step };
    case 'ArrowLeft':
      return { dx: -step, dy: 0 };
    case 'ArrowRight':
      return { dx: step, dy: 0 };
    default:
      return null;
  }
}

export function resolveShortcut(event: ShortcutKeyEvent, focus: ShortcutFocus): EditorShortcut | null {
  // Keys pressed while an IME is composing belong to the composition.
  if (event.isComposing) return null;

  const command = event.metaKey || event.ctrlKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  // Saving is safe from anywhere and must not open the browser's own dialog.
  if (command && !event.altKey && key === 's') return { type: 'save' };

  if (focus === 'text') return null;

  if (command && !event.altKey) {
    switch (key) {
      case 'z':
        return event.shiftKey ? { type: 'redo' } : { type: 'undo' };
      case 'y':
        return { type: 'redo' };
      case 'c':
        return { type: 'copy' };
      case 'x':
        return { type: 'cut' };
      case 'd':
        return { type: 'duplicate' };
      case 'a':
        return { type: 'selectAll' };
      case ']':
        return event.shiftKey ? { type: 'bringToFront' } : { type: 'bringForward' };
      case '[':
        return event.shiftKey ? { type: 'sendToBack' } : { type: 'sendBackward' };
      // Shift+] and Shift+[ report the shifted character on US layouts.
      case '}':
        return { type: 'bringToFront' };
      case '{':
        return { type: 'sendToBack' };
      case '=':
      case '+':
        return { type: 'zoomIn' };
      case '-':
        return { type: 'zoomOut' };
      case '0':
        return { type: 'zoomFit' };
      default:
        return null;
    }
  }

  if (event.altKey) return null;

  // Shift+1 fits the artboard, Shift+0 shows it at 100%. Matched on the
  // physical key because the shifted character differs between layouts.
  if (event.shiftKey && event.code === 'Digit1') return { type: 'zoomFit' };
  if (event.shiftKey && event.code === 'Digit0') return { type: 'zoomActual' };

  if (key === 'Escape') return { type: 'escape' };
  if (key === 'Delete' || key === 'Backspace') return { type: 'delete' };

  // A focused slider or button uses the arrow keys itself.
  if (focus === 'control') return null;

  const delta = arrowDelta(key, event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP);
  return delta ? { type: 'nudge', ...delta } : null;
}
