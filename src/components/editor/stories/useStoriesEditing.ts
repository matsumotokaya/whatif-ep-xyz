import { useRef, useState } from 'react';
import type { TextElement } from '../types/template';
import type { DocumentStore } from '../utils/documentStore';
import type { TextDefaults } from '../utils/elementFactory';
import type { StoriesTextValue } from './StoriesTextEditor';
import { useEventCallback } from '../hooks/useEventCallback';

// Stories fullscreen text editing session (E2-c): either editing an existing
// text element or composing a new one (added on Done, centered on canvas).
export type StoriesTextSession = { mode: 'edit'; elementId: string } | { mode: 'new' };

export type StoriesSheetKind = 'stamps' | 'background' | 'effects';

interface UseStoriesEditingOptions {
  store: DocumentStore;
  textDefaults: TextDefaults;
  setTextDefaults: (update: (previous: TextDefaults) => TextDefaults) => void;
  selectElements: (ids: string[]) => void;
  addCenteredText: (text: string, overrides: Partial<TextDefaults>) => void;
  deleteElement: (id: string) => void;
  saveSoon: () => void;
}

// UI state of the Stories (phone) shell: the fullscreen text editor session,
// the add-tool sheets and the drag-to-trash coordination with the canvas.
export function useStoriesEditing({
  store,
  textDefaults,
  setTextDefaults,
  selectElements,
  addCenteredText,
  deleteElement,
  saveSoon,
}: UseStoriesEditingOptions) {
  // While non-null the overlay is mounted, the shell chrome is hidden and
  // canvas interactions (pinch/drag/trash) are blocked.
  const [textSession, setTextSession] = useState<StoriesTextSession | null>(null);

  // Add-tool sheets (E3): image library / background color / effects. Only
  // one is open at a time.
  const [sheet, setSheet] = useState<StoriesSheetKind | null>(null);

  // Drag-to-trash (E2-b): Canvas reports drag progress, StoriesShell renders
  // the trash zone whose DOM rect Canvas hit-tests.
  const trashRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{ dragging: boolean; overTrash: boolean }>({
    dragging: false,
    overTrash: false,
  });

  const textInitialValue = (): StoriesTextValue => {
    if (textSession?.mode === 'edit') {
      const element = store.getState().elements.find((el) => el.id === textSession.elementId);
      if (element?.type === 'text') {
        return { text: element.text, fontFamily: element.fontFamily, fill: element.fill, fontSize: element.fontSize };
      }
    }
    // New text seeds from the sticky defaults so the last used font/color/size
    // carry over.
    return { text: '', fontFamily: textDefaults.fontFamily, fill: textDefaults.fill, fontSize: textDefaults.fontSize };
  };

  // Existing text: opened by tapping the already-selected element (or
  // double-tapping) — wired from Canvas via onStoriesTextEdit.
  const requestTextEdit = useEventCallback((element: TextElement) => {
    if (textSession || element.locked) return;
    selectElements([element.id]);
    setTextSession({ mode: 'edit', elementId: element.id });
  });

  // New text: opened from the shell's "Aa" button.
  const startNewText = useEventCallback(() => {
    if (textSession) return;
    setTextSession({ mode: 'new' });
  });

  const cancelText = useEventCallback(() => setTextSession(null));

  const finishText = useEventCallback((value: StoriesTextValue) => {
    const session = textSession;
    setTextSession(null);
    if (!session) return;

    const isEmpty = value.text.trim() === '';
    const style = { fontFamily: value.fontFamily, fill: value.fill, fontSize: value.fontSize };

    if (session.mode === 'edit') {
      const element = store.getState().elements.find((el) => el.id === session.elementId);
      if (!element || element.type !== 'text') return;

      if (isEmpty) {
        // Confirming empty text deletes the element (IG behavior).
        deleteElement(session.elementId);
        return;
      }

      // One command -> the whole session is one undo entry.
      store.apply({ type: 'updateElement', id: session.elementId, updates: { text: value.text, ...style } });
      saveSoon();
    } else {
      if (isEmpty) return; // IG behavior: empty new text adds nothing
      addCenteredText(value.text, style);
    }

    // Sticky defaults: the confirmed font/color/size seed the next new text.
    setTextDefaults((previous) => ({ ...previous, ...style }));
  });

  return {
    textSession,
    textInitialValue,
    requestTextEdit,
    startNewText,
    cancelText,
    finishText,
    sheet,
    setSheet,
    trashRef,
    dragState,
    setDragState,
  };
}
