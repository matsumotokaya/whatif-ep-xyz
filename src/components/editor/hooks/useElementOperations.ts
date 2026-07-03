import type { CanvasElement, TextElement, ShapeElement, ImageElement } from '../types/template';

interface UseElementOperationsProps {
  setElements: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  saveToHistory: (elements: CanvasElement[]) => void;
}

export const useElementOperations = ({
  setElements,
  saveToHistory,
}: UseElementOperationsProps) => {

  // Update a single element with partial updates
  // Using functional update pattern to avoid closure issues
  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    console.log('[updateElement] Updating element:', id, 'with updates:', updates);

    setElements((prevElements) => {
      console.log('[updateElement] Current elements count:', prevElements.length);
      console.log('[updateElement] Current element IDs:', prevElements.map(el => el.id));

      const newElements = prevElements.map((el) => {
        if (el.id === id) {
          // Type-safe merge based on element type
          if (el.type === 'text' && updates.type === 'text') {
            return { ...el, ...updates } as TextElement;
          } else if (el.type === 'shape' && updates.type === 'shape') {
            return { ...el, ...updates } as ShapeElement;
          } else if (el.type === 'image' && updates.type === 'image') {
            return { ...el, ...updates } as ImageElement;
          } else {
            // For updates without type change
            return { ...el, ...updates } as CanvasElement;
          }
        }
        return el;
      });

      console.log('[updateElement] New elements count:', newElements.length);
      console.log('[updateElement] New element IDs:', newElements.map(el => el.id));

      // Save to history with the new elements
      saveToHistory(newElements);
      return newElements;
    });
  };

  // Update multiple elements (by IDs) with same property changes
  const updateElements = (
    ids: string[],
    updateFn: (element: CanvasElement) => Partial<CanvasElement>
  ) => {
    setElements((prevElements) => {
      const newElements = prevElements.map((el) => {
        if (ids.includes(el.id)) {
          const updates = updateFn(el);
          return { ...el, ...updates } as CanvasElement;
        }
        return el;
      });

      saveToHistory(newElements);
      return newElements;
    });
  };

  // Delete elements by IDs
  const deleteElements = (ids: string[]) => {
    setElements((prevElements) => {
      const newElements = prevElements.filter((el) => !ids.includes(el.id));
      saveToHistory(newElements);
      return newElements;
    });
  };

  // Add new element
  const addElement = (element: CanvasElement) => {
    setElements((prevElements) => {
      const newElements = [...prevElements, element];
      saveToHistory(newElements);
      return newElements;
    });
  };

  // Bring elements to front (z-index)
  const bringToFront = (ids: string[]) => {
    setElements((prevElements) => {
      const selectedElements = ids
        .map(id => prevElements.find(el => el.id === id))
        .filter((el): el is CanvasElement => el !== undefined);

      const remainingElements = prevElements.filter(el => !ids.includes(el.id));
      const reordered = [...remainingElements, ...selectedElements];

      saveToHistory(reordered);
      return reordered;
    });
  };

  // Send elements to back (z-index)
  const sendToBack = (ids: string[]) => {
    setElements((prevElements) => {
      const selectedElements = ids
        .map(id => prevElements.find(el => el.id === id))
        .filter((el): el is CanvasElement => el !== undefined);

      const remainingElements = prevElements.filter(el => !ids.includes(el.id));
      const reordered = [...selectedElements, ...remainingElements];

      saveToHistory(reordered);
      return reordered;
    });
  };

  // Reorder elements (for layer drag & drop)
  const reorderElements = (newOrder: CanvasElement[]) => {
    setElements(() => {
      saveToHistory(newOrder);
      return newOrder;
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