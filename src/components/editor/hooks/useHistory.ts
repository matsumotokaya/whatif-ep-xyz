import { useState, useCallback, useRef, useEffect } from 'react';
import type { CanvasElement } from '../types/template';

const MAX_HISTORY = 50;

export const useHistory = () => {
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const historyIndexRef = useRef(historyIndex);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const cloneElements = (elements: CanvasElement[]) =>
    JSON.parse(JSON.stringify(elements)) as CanvasElement[];

  const resetHistory = useCallback((initialElements: CanvasElement[] = []) => {
    const initialSnapshot = cloneElements(initialElements);
    setHistory([initialSnapshot]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
  }, []);

  const saveToHistory = useCallback((newElements: CanvasElement[]) => {
    setHistory((prevHistory) => {
      const truncated = prevHistory.slice(0, historyIndexRef.current + 1);
      truncated.push(cloneElements(newElements));
      const limitedHistory = truncated.slice(-MAX_HISTORY);
      const nextIndex = limitedHistory.length - 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      return limitedHistory;
    });
  }, []);

  const undo = useCallback((): CanvasElement[] | null => {
    if (historyIndexRef.current > 0) {
      const nextIndex = historyIndexRef.current - 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      return cloneElements(history[nextIndex]);
    }
    return null;
  }, [history]);

  const redo = useCallback((): CanvasElement[] | null => {
    if (historyIndexRef.current < history.length - 1) {
      const nextIndex = historyIndexRef.current + 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      return cloneElements(history[nextIndex]);
    }
    return null;
  }, [history]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return {
    resetHistory,
    saveToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
