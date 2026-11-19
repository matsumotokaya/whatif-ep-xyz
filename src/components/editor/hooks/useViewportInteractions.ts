import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ViewportStore } from '../utils/viewportStore';
import { wheelZoomScale } from '../utils/viewportMath';
import { classifyShortcutFocus } from '../utils/editorShortcuts';
import { useEventCallback } from './useEventCallback';

interface UseViewportInteractionsOptions {
  store: ViewportStore;
  containerRef: RefObject<HTMLElement | null>;
  // True while a resize/rotate handle is being dragged; the view must not pan.
  isTransformingRef: RefObject<boolean>;
}

// Safari's non-standard trackpad pinch event.
interface GestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

const WHEEL_LINE_HEIGHT_PX = 16;

function touchDistance(a: Touch, b: Touch): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

// Zoom and pan input for the Studio canvas area: wheel and trackpad, pinch,
// Space/middle-button drag, and one-finger touch pan from the background.
export function useViewportInteractions({ store, containerRef, isTransformingRef }: UseViewportInteractionsOptions) {
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const stopPanRef = useRef<(() => void) | null>(null);

  // Keep the canvas area size in the store.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => store.setContainer({ width: container.clientWidth, height: container.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [store, containerRef]);

  // Wheel, trackpad and touch pinch.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const toLocal = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    // Wheel events arrive faster than frames; apply their sum once per frame.
    let frame: number | null = null;
    let zoomDelta = 0;
    let zoomAnchor = { x: 0, y: 0 };
    let panX = 0;
    let panY = 0;

    const flush = () => {
      frame = null;
      if (zoomDelta !== 0) {
        store.zoomAt(zoomAnchor, wheelZoomScale(store.getState().view.scale, zoomDelta));
        zoomDelta = 0;
      }
      if (panX !== 0 || panY !== 0) {
        store.pan(panX, panY);
        panX = 0;
        panY = 0;
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? WHEEL_LINE_HEIGHT_PX : 1;

      // Ctrl/Cmd + wheel zooms; a trackpad pinch arrives the same way.
      if (event.ctrlKey || event.metaKey) {
        zoomDelta += event.deltaY * unit;
        zoomAnchor = toLocal(event.clientX, event.clientY);
      } else if (event.shiftKey && event.deltaX === 0) {
        // Shift turns a vertical wheel into a horizontal scroll.
        panX -= event.deltaY * unit;
      } else {
        panX -= event.deltaX * unit;
        panY -= event.deltaY * unit;
      }
      frame ??= requestAnimationFrame(flush);
    };

    // Two-finger pinch on touch screens: zoom about the midpoint and pan with it.
    let pinch: { startDistance: number; startScale: number; lastMid: { x: number; y: number } } | null = null;
    let touchCount = 0;

    const handleTouchStart = (event: TouchEvent) => {
      touchCount = event.touches.length;
      if (event.touches.length !== 2) {
        pinch = null;
        return;
      }
      const [first, second] = [event.touches[0], event.touches[1]];
      const distance = touchDistance(first, second);
      if (!Number.isFinite(distance) || distance <= 0) return;
      pinch = {
        startDistance: distance,
        startScale: store.getState().view.scale,
        lastMid: toLocal((first.clientX + second.clientX) / 2, (first.clientY + second.clientY) / 2),
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const [first, second] = [event.touches[0], event.touches[1]];
      const distance = touchDistance(first, second);
      if (!Number.isFinite(distance) || distance <= 0) return;

      const mid = toLocal((first.clientX + second.clientX) / 2, (first.clientY + second.clientY) / 2);
      store.pan(mid.x - pinch.lastMid.x, mid.y - pinch.lastMid.y);
      store.zoomAt(mid, pinch.startScale * (distance / pinch.startDistance));
      pinch.lastMid = mid;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      touchCount = event.touches.length;
      if (event.touches.length < 2) pinch = null;
    };

    // Safari reports a trackpad pinch as gesture events instead of Ctrl+wheel.
    // On touch devices the same events accompany a finger pinch, which the
    // touch handlers above already cover.
    let gestureStartScale = 1;
    const handleGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStartScale = store.getState().view.scale;
    };
    const handleGestureChange = (event: Event) => {
      event.preventDefault();
      if (touchCount > 0) return;
      const gesture = event as GestureEvent;
      if (!Number.isFinite(gesture.scale) || gesture.scale <= 0) return;
      store.zoomAt(toLocal(gesture.clientX, gesture.clientY), gestureStartScale * gesture.scale);
    };
    const preventDefault = (event: Event) => event.preventDefault();

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    container.addEventListener('gesturestart', handleGestureStart);
    container.addEventListener('gesturechange', handleGestureChange);
    container.addEventListener('gestureend', preventDefault);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('gesturestart', handleGestureStart);
      container.removeEventListener('gesturechange', handleGestureChange);
      container.removeEventListener('gestureend', preventDefault);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [store, containerRef]);

  // The browser's own page zoom would scale the whole editor. Block it
  // everywhere while the editor is open, not only over the canvas area.
  useEffect(() => {
    const blockPageZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    const blockGestureZoom = (event: Event) => event.preventDefault();

    document.addEventListener('wheel', blockPageZoom, { passive: false });
    document.addEventListener('gesturestart', blockGestureZoom);
    return () => {
      document.removeEventListener('wheel', blockPageZoom);
      document.removeEventListener('gesturestart', blockGestureZoom);
    };
  }, []);

  // Holding Space turns the pointer into the hand tool.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' || event.repeat) return;
      if (classifyShortcutFocus(event.target as HTMLElement | null) !== 'canvas') return;
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      setIsSpaceHeld(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') setIsSpaceHeld(false);
    };
    const release = () => setIsSpaceHeld(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', release);
    };
  }, []);

  useEffect(() => () => stopPanRef.current?.(), []);

  // Drag-to-pan with the mouse. Listens on window so the pan keeps tracking
  // when the pointer leaves the canvas area.
  const beginMousePan = useEventCallback((clientX: number, clientY: number) => {
    if (isTransformingRef.current) return;
    stopPanRef.current?.();

    const { offsetX, offsetY } = store.getState().view;
    const listeners = new AbortController();
    const stop = () => {
      listeners.abort();
      stopPanRef.current = null;
      setIsPanning(false);
    };
    const handleMove = (event: MouseEvent) => {
      store.panTo(offsetX + event.clientX - clientX, offsetY + event.clientY - clientY);
    };

    const { signal } = listeners;
    window.addEventListener('mousemove', handleMove, { signal });
    window.addEventListener('mouseup', stop, { signal });
    window.addEventListener('blur', stop, { signal });
    stopPanRef.current = stop;
    setIsPanning(true);
  });

  // One-finger pan on touch screens.
  const beginTouchPan = useEventCallback((clientX: number, clientY: number) => {
    if (isTransformingRef.current) return;
    stopPanRef.current?.();

    const { offsetX, offsetY } = store.getState().view;
    const listeners = new AbortController();
    // Once a second finger has joined, the gesture is a pinch: the finger that
    // stays down afterwards must not resume panning.
    let pinched = false;
    const stop = () => {
      listeners.abort();
      stopPanRef.current = null;
      setIsPanning(false);
    };
    const handleMove = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        pinched = true;
        return;
      }
      if (pinched || isTransformingRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      store.panTo(offsetX + touch.clientX - clientX, offsetY + touch.clientY - clientY);
    };
    const handleEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) stop();
    };

    const { signal } = listeners;
    window.addEventListener('touchmove', handleMove, { passive: true, signal });
    window.addEventListener('touchend', handleEnd, { signal });
    window.addEventListener('touchcancel', handleEnd, { signal });
    stopPanRef.current = stop;
    setIsPanning(true);
  });

  return { isPanning, isSpaceHeld, beginMousePan, beginTouchPan };
}
