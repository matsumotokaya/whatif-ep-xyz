import { useEffect } from 'react';

interface KeyboardShortcutsConfig {
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onMoveUp?: (distance: number) => void;
  onMoveDown?: (distance: number) => void;
  onMoveLeft?: (distance: number) => void;
  onMoveRight?: (distance: number) => void;
}

export const useKeyboardShortcuts = ({
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDelete,
  onSave,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
}: KeyboardShortcutsConfig) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in input fields or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        onUndo?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Save (Cmd+S / Ctrl+S)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Copy/Paste
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        onCopy?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        onPaste?.();
        return;
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDelete?.();
        return;
      }

      // Arrow keys for moving objects (Photoshop-style)
      // Normal: 1px, Shift: 10px
      const distance = e.shiftKey ? 10 : 1;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onMoveUp?.(distance);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onMoveDown?.(distance);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onMoveLeft?.(distance);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onMoveRight?.(distance);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo, onCopy, onPaste, onDelete, onSave, onMoveUp, onMoveDown, onMoveLeft, onMoveRight]);
};
