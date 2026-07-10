import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '../utils/cn';

// iOS-style draggable bottom sheet with snap detents. The sheet keeps a stable
// layout size and changes its visible area with a compositor-only transform.
const SHEET_MEDIUM_RATIO = 0.6;
const SHEET_LARGE_RATIO = 0.9;

const SHEET_PEEK_PX = 120;
const SHEET_PEEK_RATIO = 0.16;
const SHEET_PEEK_MAX_PX = 160;
const FALLBACK_VIEWPORT_HEIGHT = 800;

const getViewportHeight = () => {
  if (typeof window === 'undefined') return FALLBACK_VIEWPORT_HEIGHT;
  return window.visualViewport?.height ?? window.innerHeight;
};

const getDetents = (viewportHeight: number) => {
  const peek = Math.min(
    SHEET_PEEK_MAX_PX,
    Math.max(SHEET_PEEK_PX, Math.round(viewportHeight * SHEET_PEEK_RATIO)),
  );
  return [
    peek,
    Math.round(viewportHeight * SHEET_MEDIUM_RATIO),
    Math.round(viewportHeight * SHEET_LARGE_RATIO),
  ];
};

interface MobileSheetProps {
  children: ReactNode;
  // Called when the user drags the sheet down past the dismiss threshold and releases.
  onDismiss?: () => void;
}

export const MobileSheet = ({ children, onDismiss }: MobileSheetProps) => {
  const initialViewportHeight = getViewportHeight();
  const initialVisibleHeight = getDetents(initialViewportHeight)[0];
  const [viewportHeight, setViewportHeight] = useState(initialViewportHeight);
  const viewportHeightRef = useRef(initialViewportHeight);
  const [visibleHeight, setVisibleHeight] = useState(initialVisibleHeight);
  const visibleHeightRef = useRef(initialVisibleHeight);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [entered, setEntered] = useState(false);
  const contentId = useId();

  const detents = getDetents(viewportHeight);
  const maxHeight = detents[detents.length - 1];

  const applyVisibleHeight = (height: number) => {
    visibleHeightRef.current = height;
    setVisibleHeight(height);
  };

  const snapToNearestDetent = () => {
    const currentDetents = getDetents(viewportHeightRef.current);
    const nearest = currentDetents.reduce(
      (best, detent) =>
        Math.abs(detent - visibleHeightRef.current) < Math.abs(best - visibleHeightRef.current)
          ? detent
          : best,
      currentDetents[0],
    );
    applyVisibleHeight(nearest);
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // visualViewport tracks mobile browser chrome and the on-screen keyboard more
  // accurately than innerHeight. Keep the window listener as a desktop fallback.
  useEffect(() => {
    const onResize = () => {
      const nextViewportHeight = getViewportHeight();
      const nextDetents = getDetents(nextViewportHeight);
      const nextMax = nextDetents[nextDetents.length - 1];

      viewportHeightRef.current = nextViewportHeight;
      setViewportHeight(nextViewportHeight);
      if (visibleHeightRef.current > nextMax) applyVisibleHeight(nextMax);
    };

    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = { startY: event.clientY, startH: visibleHeightRef.current, moved: false };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const currentDetents = getDetents(viewportHeightRef.current);
    const min = Math.round(currentDetents[0] * 0.45);
    const max = currentDetents[currentDetents.length - 1];
    const delta = event.clientY - drag.startY;
    if (Math.abs(delta) > 3) drag.moved = true;
    applyVisibleHeight(Math.min(max, Math.max(min, drag.startH - delta)));
  };

  const finishPointerInteraction = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const currentDetents = getDetents(viewportHeightRef.current);
    if (onDismiss && visibleHeightRef.current < currentDetents[0] * 0.72) {
      onDismiss();
      return;
    }

    snapToNearestDetent();
    if (drag.moved) {
      suppressClickRef.current = true;
      requestAnimationFrame(() => {
        suppressClickRef.current = false;
      });
    }
  };

  const handleToggle = () => {
    if (suppressClickRef.current) return;
    const currentDetents = getDetents(viewportHeightRef.current);
    const isExpanded = visibleHeightRef.current > currentDetents[0] + 1;
    applyVisibleHeight(isExpanded ? currentDetents[0] : currentDetents[1]);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const currentDetents = getDetents(viewportHeightRef.current);
    const currentIndex = currentDetents.reduce(
      (bestIndex, detent, index) =>
        Math.abs(detent - visibleHeightRef.current) <
        Math.abs(currentDetents[bestIndex] - visibleHeightRef.current)
          ? index
          : bestIndex,
      0,
    );

    let nextIndex: number | null = null;
    if (event.key === 'ArrowUp') nextIndex = Math.min(currentIndex + 1, currentDetents.length - 1);
    if (event.key === 'ArrowDown') nextIndex = Math.max(currentIndex - 1, 0);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = currentDetents.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      applyVisibleHeight(currentDetents[nextIndex]);
    } else if (event.key === 'Escape' && onDismiss) {
      event.preventDefault();
      onDismiss();
    }
  };

  const translateY = entered ? maxHeight - visibleHeight : maxHeight;
  const isExpanded = visibleHeight > detents[0] + 1;

  return (
    <section
      aria-label="編集ツール"
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-[#2b2b2b] bg-[#1a1a1a]/90 shadow-2xl backdrop-blur-md',
        !isDragging && 'motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out',
      )}
      style={{
        height: maxHeight,
        maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))',
        transform: `translateY(${translateY}px)`,
      }}
    >
      <button
        type="button"
        aria-label="編集ツールの高さを調整"
        aria-controls={contentId}
        aria-expanded={isExpanded}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={finishPointerInteraction}
        onLostPointerCapture={finishPointerInteraction}
        className="flex shrink-0 touch-none select-none items-center justify-center pt-2.5 pb-2 cursor-grab focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white active:cursor-grabbing"
      >
        <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-gray-500" />
      </button>
      <div
        id={contentId}
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch]"
      >
        {children}
      </div>
    </section>
  );
};
