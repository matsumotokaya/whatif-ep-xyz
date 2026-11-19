import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import type Konva from 'konva';
import type { CanvasElement } from '../../types/template';
import { buildTransformUpdates, isCenterOriginElement } from '../../utils/konvaCommit';
import {
  getPinchDelta,
  buildPinchTransformInput,
  getCenterSnap,
  isPointInRect,
  reconcilePinchFlagsOnTouchEnd,
  CENTER_SNAP_SCREEN_PX,
  TRASH_HIT_INFLATE_PX,
  type TouchPoint,
  type PinchStartSnapshot,
} from '../../utils/storiesGestures';
import type { ElementDragEvent } from './elementNode';

// Element interaction stays blocked for this long after a two-finger gesture,
// so the finger that lifts last does not select or drag something.
const PINCH_SETTLE_MS = 180;

interface TouchGestureOptions {
  isStoriesMode: boolean;
  // True while the fullscreen Stories text editor overlay is open.
  storiesTextEditActive: boolean;
  isEditing: boolean;
  scale: number;
  template: { width: number; height: number };
  elements: CanvasElement[];
  selectedIdsRef: RefObject<string[]>;
  nodesRef: RefObject<Map<string, Konva.Node>>;
  // Called after every in-flight node drag has been stopped programmatically.
  onDragsStopped: () => void;
  onElementTransientUpdate?: (id: string, updates: Partial<CanvasElement>) => void;
  onInteractionCommit?: () => void;
  onStoriesDragStateChange?: (state: { dragging: boolean; overTrash: boolean }) => void;
  onStoriesDeleteElement?: (id: string) => void;
  storiesTrashRef?: RefObject<HTMLDivElement | null>;
}

// Touch handling shared by both shells: the two-finger guard that keeps a pinch
// from selecting or dragging elements, plus the Stories-only gestures
// (pinch/twist the selected element, center snap, drag to trash).
export function useTouchGestures({
  isStoriesMode,
  storiesTextEditActive,
  isEditing,
  scale,
  template,
  elements,
  selectedIdsRef,
  nodesRef,
  onDragsStopped,
  onElementTransientUpdate,
  onInteractionCommit,
  onStoriesDragStateChange,
  onStoriesDeleteElement,
  storiesTrashRef,
}: TouchGestureOptions) {
  const isPinchingRef = useRef(false);
  const hadPinchGestureRef = useRef(false);
  const pinchBlockUntilRef = useRef(0);

  // Active two-finger pinch/twist session on the selected element.
  const pinchSessionRef = useRef<{
    elementId: string;
    touchIds: [number, number];
    startTouches: [TouchPoint, TouchPoint];
    start: PinchStartSnapshot;
    // Element snapshot at gesture start: the transform is always applied to
    // the START values so transient updates stay absolute and idempotent.
    startElement: CanvasElement;
  } | null>(null);

  // Single-element drag tracking for snap guides and trash drop.
  const storiesDragRef = useRef<{ elementId: string | null; overTrash: boolean }>({
    elementId: null,
    overTrash: false,
  });
  const [snapGuides, setSnapGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  const clearSnapGuides = () => {
    setSnapGuides((prev) => (prev.v || prev.h ? { v: false, h: false } : prev));
  };

  const isInteractionBlocked = () => {
    return (
      isPinchingRef.current ||
      Date.now() < pinchBlockUntilRef.current ||
      // While the fullscreen text editor overlay is open, nothing on the
      // canvas may react (drag, trash, selection).
      (isStoriesMode && storiesTextEditActive)
    );
  };

  const stopActiveDrags = () => {
    // A programmatic drag stop (pinch takeover) must never count as a trash
    // drop: clear the hover flag and restore the preview dim BEFORE stopDrag
    // fires the synchronous dragend that reads it.
    if (storiesDragRef.current.elementId && storiesDragRef.current.overTrash) {
      const { elementId } = storiesDragRef.current;
      storiesDragRef.current.overTrash = false;
      const node = nodesRef.current.get(elementId);
      const element = elements.find((el) => el.id === elementId);
      node?.opacity(element?.opacity ?? 1);
    }

    nodesRef.current.forEach((node) => {
      const draggableNode = node as Konva.Node & { isDragging?: () => boolean; stopDrag?: () => void };
      if (typeof draggableNode.isDragging === 'function' && draggableNode.isDragging()) {
        draggableNode.stopDrag?.();
      }
    });

    onDragsStopped();
  };

  const markPinch = () => {
    isPinchingRef.current = true;
    hadPinchGestureRef.current = true;
    pinchBlockUntilRef.current = Date.now() + PINCH_SETTLE_MS;
  };

  // --- Stories mode: two-finger pinch/twist on the selected element ---
  //
  // Instagram-style: while exactly one element is selected, two fingers
  // ANYWHERE on the screen scale (pinch), rotate (twist) and move (midpoint
  // drag) that element. Listeners live on window so the gesture also works
  // when the fingers land outside the Konva Stage. Updates go through the
  // transient path and are committed as one undo entry on release.

  const tryStartStoriesPinch = useEffectEvent((e: TouchEvent) => {
    // storiesTextEditActive: the fullscreen text editor overlay is open —
    // these are WINDOW-level listeners, so without this guard two fingers
    // on the overlay would pinch the element behind it.
    if (pinchSessionRef.current || e.touches.length < 2 || isEditing || storiesTextEditActive) return;

    const ids = selectedIdsRef.current;
    if (ids.length !== 1) return;
    const element = elements.find((el) => el.id === ids[0]);
    if (!element || element.locked || !(element.visible ?? true)) return;
    const node = nodesRef.current.get(element.id);
    if (!node) return;

    // A second finger interrupts an in-progress one-finger drag. stopDrag()
    // fires dragend synchronously, so the drag's position commit lands
    // before the pinch snapshot below reads the node.
    markPinch();
    stopActiveDrags();

    const t0 = e.touches[0];
    const t1 = e.touches[1];
    pinchSessionRef.current = {
      elementId: element.id,
      touchIds: [t0.identifier, t1.identifier],
      startTouches: [
        { x: t0.clientX, y: t0.clientY },
        { x: t1.clientX, y: t1.clientY },
      ],
      start: {
        nodeX: node.x(),
        nodeY: node.y(),
        width: node.width(),
        height: node.height(),
        rotation: node.rotation(),
        isCenterOrigin: isCenterOriginElement(element),
      },
      startElement: element,
    };
  });

  const moveStoriesPinch = useEffectEvent((e: TouchEvent) => {
    const session = pinchSessionRef.current;
    if (!session) return;

    const findTouch = (id: number) => {
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === id) return e.touches[i];
      }
      return null;
    };
    const t0 = findTouch(session.touchIds[0]);
    const t1 = findTouch(session.touchIds[1]);
    if (!t0 || !t1) return;

    isPinchingRef.current = true;
    pinchBlockUntilRef.current = Date.now() + PINCH_SETTLE_MS;

    const delta = getPinchDelta(session.startTouches, [
      { x: t0.clientX, y: t0.clientY },
      { x: t1.clientX, y: t1.clientY },
    ]);
    const input = buildPinchTransformInput(session.start, delta, 1 / scale);
    onElementTransientUpdate?.(
      session.elementId,
      buildTransformUpdates(session.startElement, input)
    );
  });

  const endStoriesPinch = useEffectEvent((e: TouchEvent) => {
    const session = pinchSessionRef.current;
    const activeTouchCount = e.touches.length;
    const wasActive = isPinchingRef.current || !!session;

    if (session) {
      // Keep the session alive only while BOTH gesture fingers are still down
      // (a stray third finger lifting must not end the pinch).
      const remaining = new Set<number>();
      for (let i = 0; i < e.touches.length; i++) {
        remaining.add(e.touches[i].identifier);
      }
      const bothFingersDown =
        remaining.has(session.touchIds[0]) && remaining.has(session.touchIds[1]);
      if (bothFingersDown) return;

      pinchSessionRef.current = null;
      onInteractionCommit?.();
    }

    // Authoritative reset: reconcile the flags from the true remaining-touch
    // count whether or not a session existed. This is what stops isPinching
    // from latching true when a two-finger press produced no session (0 or 2+
    // selected, or a locked element) and the fingers then lifted off the
    // canvas, where the Stage-level touchend/cancel never fires.
    const flags = reconcilePinchFlagsOnTouchEnd(
      { isPinching: isPinchingRef.current, hadPinchGesture: hadPinchGestureRef.current },
      activeTouchCount,
    );
    isPinchingRef.current = flags.isPinching;
    hadPinchGestureRef.current = flags.hadPinchGesture;
    if (wasActive && activeTouchCount < 2) {
      pinchBlockUntilRef.current = Date.now() + PINCH_SETTLE_MS;
    }
  });

  // Hard reset of the entire Stories gesture machine. Used when an external
  // event (the fullscreen text editor opening, unmount) can swallow the
  // in-progress touch stream so the matching touchend/touchcancel never
  // arrives — without this the pinch session / isPinching would stay latched
  // and block every canvas interaction afterwards.
  const forceEndStoriesGesture = useEffectEvent(() => {
    if (pinchSessionRef.current) {
      pinchSessionRef.current = null;
      // Commit whatever transient transform was in flight so nothing is lost.
      onInteractionCommit?.();
    }
    isPinchingRef.current = false;
    hadPinchGestureRef.current = false;
    pinchBlockUntilRef.current = 0;
    if (storiesDragRef.current.elementId) {
      onStoriesDragStateChange?.({ dragging: false, overTrash: false });
    }
    stopActiveDrags();
    storiesDragRef.current = { elementId: null, overTrash: false };
    clearSnapGuides();
  });

  useEffect(() => {
    if (!isStoriesMode) return;

    const handleTouchStart = (e: TouchEvent) => {
      tryStartStoriesPinch(e);
      if (pinchSessionRef.current) e.preventDefault();
    };
    const handleTouchMove = (e: TouchEvent) => {
      // Also try to START here: covers the finger race where the selection
      // state has not flushed yet at touchstart, and drag-to-pinch handoff.
      tryStartStoriesPinch(e);
      if (pinchSessionRef.current) {
        e.preventDefault();
        moveStoriesPinch(e);
      }
    };
    const handleTouchEnd = (e: TouchEvent) => endStoriesPinch(e);

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      pinchSessionRef.current = null;
    };
  }, [isStoriesMode]);

  // Opening the fullscreen text editor overlay can steal the in-progress touch
  // stream (iOS may never deliver the matching touchend/touchcancel). That
  // would leave the pinch session / isPinching latched, so once the editor
  // closes NOTHING on the canvas could be selected or dragged — and because a
  // latched session makes the window touchstart handler call preventDefault on
  // every tap, even the shell buttons stop responding. Force the gesture
  // machine back to a clean state whenever the overlay opens.
  useEffect(() => {
    if (isStoriesMode && storiesTextEditActive) {
      forceEndStoriesGesture();
    }
  }, [isStoriesMode, storiesTextEditActive]);

  // --- Stage-level two-finger guard (both shells) ---

  // Returns true when the touch is part of a multi-finger gesture and must not
  // reach element or background handling.
  const handleStageTouchStart = (touchCount: number): boolean => {
    if (touchCount < 2) return false;
    markPinch();
    stopActiveDrags();
    return true;
  };

  const handleStageTouchMove = (touchCount: number): boolean => {
    if (touchCount < 2) return false;
    markPinch();
    stopActiveDrags();
    return true;
  };

  const handleStageTouchEnd = (remainingTouchCount: number) => {
    if (remainingTouchCount >= 2) return;
    isPinchingRef.current = false;
    if (hadPinchGestureRef.current) {
      pinchBlockUntilRef.current = Date.now() + PINCH_SETTLE_MS;
    }
    if (remainingTouchCount === 0) {
      hadPinchGestureRef.current = false;
    }
  };

  const handleStageTouchCancel = () => {
    isPinchingRef.current = false;
    if (hadPinchGestureRef.current) {
      pinchBlockUntilRef.current = Date.now() + PINCH_SETTLE_MS;
    }
    hadPinchGestureRef.current = false;
  };

  // --- Stories single-element drag: center snap + trash drop ---

  const beginStoriesDrag = (id: string) => {
    // Track the single-element drag for snap guides + trash drop and let
    // the shell show the trash zone.
    storiesDragRef.current = { elementId: id, overTrash: false };
    onStoriesDragStateChange?.({ dragging: true, overTrash: false });
  };

  const isStoriesDragging = (id: string) => storiesDragRef.current.elementId === id;

  const moveStoriesDrag = (id: string, event: ElementDragEvent) => {
    const node = event.target;
    const layer = node.getLayer();

    // Center snap: compare the element's bounding-box center (canvas units,
    // layer space carries no stage transform) against the artboard center.
    // The snap distance is fixed in screen px, hence the / scale.
    const rect = layer ? node.getClientRect({ relativeTo: layer }) : node.getClientRect();
    const snap = getCenterSnap(
      { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      { width: template.width, height: template.height },
      CENTER_SNAP_SCREEN_PX / scale
    );
    if (snap.dx !== 0 || snap.dy !== 0) {
      node.position({ x: node.x() + snap.dx, y: node.y() + snap.dy });
    }
    setSnapGuides((prev) =>
      prev.v === snap.snappedX && prev.h === snap.snappedY
        ? prev
        : { v: snap.snappedX, h: snap.snappedY }
    );

    // Trash drop: hit-test the pointer against the shell's trash zone rect.
    const evt = event.evt as unknown as MouseEvent | TouchEvent;
    const pointer: TouchPoint | null =
      'touches' in evt && evt.touches.length > 0
        ? { x: evt.touches[0].clientX, y: evt.touches[0].clientY }
        : 'clientX' in evt
          ? { x: evt.clientX, y: evt.clientY }
          : null;
    const trashRect = storiesTrashRef?.current?.getBoundingClientRect();
    const overTrash = !!(
      pointer && trashRect && isPointInRect(pointer, trashRect, TRASH_HIT_INFLATE_PX)
    );

    if (overTrash !== storiesDragRef.current.overTrash) {
      storiesDragRef.current.overTrash = overTrash;
      // Preview-only feedback: dim the node while it hovers the trash. The
      // real element opacity is untouched and restored on release.
      const element = elements.find((el) => el.id === id);
      node.opacity(overTrash ? 0.4 : (element?.opacity ?? 1));
      onStoriesDragStateChange?.({ dragging: true, overTrash });
      layer?.batchDraw();
    }
  };

  // Ends the Stories drag. Returns true when the element was dropped on the
  // trash and deleted, in which case its position must not be committed.
  const endStoriesDrag = (id: string, event: ElementDragEvent): boolean => {
    const wasOverTrash = storiesDragRef.current.overTrash;
    storiesDragRef.current = { elementId: null, overTrash: false };
    clearSnapGuides();
    onStoriesDragStateChange?.({ dragging: false, overTrash: false });

    if (!wasOverTrash) return false;

    // Restore the preview dim before the node goes away / stays around.
    const element = elements.find((el) => el.id === id);
    event.target.opacity(element?.opacity ?? 1);
    if (!onStoriesDeleteElement) return false;
    onStoriesDeleteElement(id);
    return true;
  };

  return {
    snapGuides,
    isInteractionBlocked,
    stopActiveDrags,
    handleStageTouchStart,
    handleStageTouchMove,
    handleStageTouchEnd,
    handleStageTouchCancel,
    beginStoriesDrag,
    isStoriesDragging,
    moveStoriesDrag,
    endStoriesDrag,
  };
}
