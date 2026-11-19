import { useEffect } from 'react';
import { classifyShortcutFocus, resolveShortcut, type EditorShortcut } from '../utils/editorShortcuts';
import { useEventCallback } from './useEventCallback';

interface UseEditorShortcutsOptions {
  // Runs the action. Return false when there was nothing to do, so the key
  // keeps its normal meaning (e.g. Cmd+C with no element selected still
  // copies the text the user highlighted).
  onShortcut: (shortcut: EditorShortcut) => boolean;
  onPaste: (event: ClipboardEvent) => boolean;
}

// A dialog owns the keyboard while it is open: editor shortcuts must not act
// on the canvas hidden behind it.
function isDialogOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

// These must never fall through to the browser, even with nothing selected:
// Cmd+[ and Cmd+] navigate history, Cmd+D bookmarks, Cmd+S opens "save page".
const ALWAYS_CAPTURED: ReadonlySet<EditorShortcut['type']> = new Set([
  'save',
  'duplicate',
  'selectAll',
  'bringForward',
  'sendBackward',
  'bringToFront',
  'sendToBack',
  'zoomIn',
  'zoomOut',
  'zoomFit',
  'zoomActual',
]);

export function useEditorShortcuts({ onShortcut, onPaste }: UseEditorShortcutsOptions) {
  const handleShortcut = useEventCallback(onShortcut);
  const handlePaste = useEventCallback(onPaste);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDialogOpen()) return;

      const focus = classifyShortcutFocus(event.target as HTMLElement | null);
      const shortcut = resolveShortcut(event, focus);
      if (!shortcut) return;

      const handled = handleShortcut(shortcut);
      if ((handled && shortcut.type !== 'escape') || ALWAYS_CAPTURED.has(shortcut.type)) {
        event.preventDefault();
      }
    };

    const handlePasteEvent = (event: ClipboardEvent) => {
      if (isDialogOpen()) return;
      if (classifyShortcutFocus(event.target as HTMLElement | null) === 'text') return;
      if (handlePaste(event)) event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePasteEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePasteEvent);
    };
  }, [handleShortcut, handlePaste]);
}
