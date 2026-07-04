import type { CanvasElement } from '../types/template';
import { applyCommand } from '../utils/documentCommands';

interface UseElementOperationsProps {
  setElements: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  saveToHistory: (elements: CanvasElement[], coalesceKey?: string) => void;
}

export const useElementOperations = ({
  setElements,
  saveToHistory,
}: UseElementOperationsProps) => {

  // Update a single element with partial updates.
  // Optional coalesceKey lets continuous gestures (e.g. arrow-key nudge)
  // collapse into a single undo entry — see useHistory's coalescing rules.
  const updateElement = (id: string, updates: Partial<CanvasElement>, coalesceKey?: string) => {
    setElements((prevElements) => {
      const newElements = applyCommand(prevElements, { type: 'updateElement', id, updates });
      saveToHistory(newElements, coalesceKey);
      return newElements;
    });
  };

  // Update multiple elements (by IDs) with same property changes
  const updateElements = (
    ids: string[],
    updateFn: (element: CanvasElement) => Partial<CanvasElement>,
    coalesceKey?: string
  ) => {
    setElements((prevElements) => {
      const newElements = applyCommand(prevElements, { type: 'updateElements', ids, updateFn });
      saveToHistory(newElements, coalesceKey);
      return newElements;
    });
  };

  // Delete elements by IDs
  const deleteElements = (ids: string[]) => {
    setElements((prevElements) => {
      const newElements = applyCommand(prevElements, { type: 'deleteElements', ids });
      saveToHistory(newElements);
      return newElements;
    });
  };

  // Add new element
  const addElement = (element: CanvasElement) => {
    setElements((prevElements) => {
      const newElements = applyCommand(prevElements, { type: 'addElement', element });
      saveToHistory(newElements);
      return newElements;
    });
  };

  // Bring elements to front (z-index)
  const bringToFront = (ids: string[]) => {
    setElements((prevElements) => {
      const newElements = applyCommand(prevElements, { type: 'bringToFront', ids });
      saveToHistory(newElements);
      return newElements;
    });
  };

  // Send elements to back (z-index)
  const sendToBack = (ids: string[]) => {
    setElements((prevElements) => {
      const newElements = applyCommand(prevElements, { type: 'sendToBack', ids });
      saveToHistory(newElements);
      return newElements;
    });
  };

  // Reorder elements (for layer drag & drop)
  const reorderElements = (newOrder: CanvasElement[]) => {
    setElements((prevElements) => {
      const newElements = applyCommand(prevElements, { type: 'reorderElements', elements: newOrder });
      saveToHistory(newElements);
      return newElements;
    });
  };

  // NOTE: No useCallback is used to avoid dependency issues
  // All functions use functional updates to get the latest state
  return {
    updateElement,
    updateElements,
    deleteElements,
    addElement,
    bringToFront,
    sendToBack,
    reorderElements,
  };
};
