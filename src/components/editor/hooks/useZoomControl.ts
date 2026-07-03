import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';

interface UseZoomControlProps {
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

export const useZoomControl = ({
  initialZoom = 40,
  minZoom = 25,
  maxZoom = 200,
  containerRef,
}: UseZoomControlProps) => {
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);

  const resetView = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(initialZoom);
  }, [initialZoom]);

  // Document-level: block browser zoom from trackpad pinch
  // Runs immediately on mount (no containerRef dependency) so it works
  // even during loading state before the canvas element is rendered.
  useEffect(() => {
    const clampZoom = (value: number, fallback: number) => {
      if (!Number.isFinite(value)) return fallback;
      return Math.round(Math.max(minZoom, Math.min(maxZoom, value)));
    };

    // Trackpad pinch on Chrome/Firefox fires as ctrlKey + wheel
    const handleDocumentWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.5;
        if (!Number.isFinite(delta)) return;
        setZoom(prev => clampZoom(prev + delta, prev));
      }
    };

    document.addEventListener('wheel', handleDocumentWheel, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleDocumentWheel);
    };
  }, [minZoom, maxZoom]);

  // Container-level: scroll pan + mobile touch pinch
  useEffect(() => {
    const mainElement = containerRef.current;
    if (!mainElement) return;

    const clampZoom = (value: number, fallback: number) => {
      if (!Number.isFinite(value)) return fallback;
      return Math.round(Math.max(minZoom, Math.min(maxZoom, value)));
    };
    let rafId: number | null = null;
    let pendingZoomDelta = 0;

    // Apply accumulated zoom via rAF to prevent render storms
    const flushZoom = () => {
      if (pendingZoomDelta !== 0) {
        const delta = pendingZoomDelta;
        pendingZoomDelta = 0;
        if (Number.isFinite(delta)) {
          setZoom(prev => clampZoom(prev + delta, prev));
        }
      }
      rafId = null;
    };

    // Mobile two-finger pinch (skipped when Safari gesture events are active)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        if (!Number.isFinite(distance) || distance <= 0) {
          lastTouchDistance.current = null;
          return;
        }
        lastTouchDistance.current = distance;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        if (!Number.isFinite(distance) || distance <= 0) return;

        const delta = distance - lastTouchDistance.current;
        if (!Number.isFinite(delta)) return;
        pendingZoomDelta += delta * 0.1;
        lastTouchDistance.current = distance;

        // Batch zoom updates via rAF
        if (rafId === null) {
          rafId = requestAnimationFrame(flushZoom);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length >= 2) return;
      lastTouchDistance.current = null;
      // Flush any remaining zoom delta
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pendingZoomDelta !== 0) {
        const delta = pendingZoomDelta;
        pendingZoomDelta = 0;
        if (Number.isFinite(delta)) {
          setZoom(prev => clampZoom(prev + delta, prev));
        }
      }
    };

    // Regular scroll (no Ctrl/Cmd) = pan
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPanOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    mainElement.addEventListener('touchstart', handleTouchStart);
    mainElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    mainElement.addEventListener('touchend', handleTouchEnd);
    mainElement.addEventListener('touchcancel', handleTouchEnd);
    mainElement.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      mainElement.removeEventListener('touchstart', handleTouchStart);
      mainElement.removeEventListener('touchmove', handleTouchMove);
      mainElement.removeEventListener('touchend', handleTouchEnd);
      mainElement.removeEventListener('touchcancel', handleTouchEnd);
      mainElement.removeEventListener('wheel', handleWheel);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [minZoom, maxZoom, containerRef]);

  return { zoom, setZoom, panOffset, setPanOffset, resetView };
};
