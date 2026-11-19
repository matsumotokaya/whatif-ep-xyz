import { BLEED } from '../utils/canvasGeometry';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Group, Rect, Line, Transformer } from 'react-konva';
import Konva from 'konva';
import type { Box as TransformBox } from 'konva/lib/shapes/Transformer';
import type { Template, CanvasElement, TextElement, ShapeElement, ImageElement } from '../types/template';
import { ShapeRenderer } from './canvas/ShapeRenderer';
import { TextRenderer } from './canvas/TextRenderer';
import { ImageRenderer } from './canvas/ImageRenderer';
import { InlineTextEditor } from './canvas/InlineTextEditor';
import { useTouchGestures } from './canvas/useTouchGestures';
import type { ElementDragEvent, ElementNodeHandlers, ElementPointerEvent } from './canvas/elementNode';
import { useEventCallback } from '../hooks/useEventCallback';
import {
  readNodeTransform,
  resetNodeScale,
  nodePositionToElementPosition,
  buildTransformUpdates,
  type NodeTransformSnapshot,
  type Position,
} from '../utils/konvaCommit';
import { computeSnap, unionBox, type Box, type SnapGuide } from '../utils/snapping';
import { isInsideBleedZone } from '../utils/viewportMath';
import {
  EDITOR_FONT_WAIT_MS,
  collectFontRequests,
  ensureTextFonts,
  fontRequestsKey,
  requestFonts,
} from '../utils/textFont';

// Elements are dragged with the primary button only; the middle button pans.
Konva.dragButtons = [0];

// Stage geometry for the Studio viewport: the stage is the size of the canvas
// area and the artboard origin sits at (originX, originY) inside it. Without a
// viewport the stage wraps the artboard plus a BLEED band at a fixed scale.
export interface CanvasViewport {
  width: number;
  height: number;
  originX: number;
  originY: number;
}

export interface CanvasProps {
  template: Template;
  elements: CanvasElement[];
  scale?: number;
  canvasColor: string;
  viewport?: CanvasViewport;
  onTextChange?: (id: string, newText: string) => void;
  selectedElementIds?: string[];
  onSelectElement?: (ids: string[]) => void;
  onElementUpdate?: (id: string, updates: Partial<CanvasElement>) => void;
  onElementsUpdate?: (ids: string[], updateFn: (element: CanvasElement) => Partial<CanvasElement>) => void;
  // `position` is the drop point in canvas units.
  onImageDrop?: (file: File, width: number, height: number, position?: Position) => void;
  onImageLoad?: (id: string, status: 'loaded' | 'error') => void;
  onBeforeExport?: () => void;
  entranceAnimationPhase?: 'idle' | 'loading' | 'animating' | 'complete';
  textPlacementMode?: boolean;
  onPlaceText?: (x: number, y: number) => string;
  onEditingChange?: (isEditing: boolean) => void;
  onBackgroundTouchStart?: (clientX: number, clientY: number) => void;
  // Studio viewport only: the primary button went down on empty space beyond
  // the bleed band, where a drag pans the view instead of drawing a marquee.
  onBackgroundPanStart?: (clientX: number, clientY: number) => void;
  onTransformingChange?: (isTransforming: boolean) => void;
  // 'studio' (default) keeps the full desktop interaction set. 'stories' is
  // the constrained mobile mode: selection frame without resize/rotate
  // handles and no lasso selection; scale/rotate happens via two-finger
  // pinch/twist on the selected element (E2-b).
  interactionMode?: 'studio' | 'stories';
  // Stories-only gesture plumbing (all unused in studio mode).
  // Transient update path: live preview during pinch, committed as ONE undo
  // entry via onInteractionCommit when the fingers lift.
  onElementTransientUpdate?: (id: string, updates: Partial<CanvasElement>) => void;
  onInteractionCommit?: () => void;
  // Reports single-element drag progress so the shell can show/highlight the
  // trash drop zone.
  onStoriesDragStateChange?: (state: { dragging: boolean; overTrash: boolean }) => void;
  // Invoked instead of the position commit when the element is dropped on
  // the trash zone.
  onStoriesDeleteElement?: (id: string) => void;
  // DOM node of the trash drop zone rendered by the Stories shell.
  storiesTrashRef?: RefObject<HTMLDivElement | null>;
  // Stories text editing (E2-c): tapping an already-selected text element
  // (or double-tapping any unlocked text) opens the fullscreen text editor
  // instead of the inline textarea used in studio mode.
  onStoriesTextEdit?: (element: TextElement) => void;
  // True while the fullscreen text editor overlay is open. Blocks the
  // window-level pinch listeners (which would otherwise react to touches
  // landing on the overlay) and any element interaction underneath it.
  storiesTextEditActive?: boolean;
}

export interface CanvasRef {
  exportImage: () => string;
  exportFullresPreview: () => string;
  exportThumbnail: () => string;
  getNodesMap: () => Map<string, Konva.Node>;
  getLayerNode: () => Konva.Layer | null;
  // True while an element is being dragged: the canvas then shows positions
  // the document does not have yet.
  isDragging: () => boolean;
  // Resolves once the canvas shows the latest document with its web fonts
  // applied (or the font wait has run out). Await this before a synchronous
  // export so `toDataURL()` never snapshots a stale frame or a fallback font.
  whenReadyForExport: () => Promise<void>;
}

// Bleed area around artboard (canvas units) so elements/transformers
// that extend beyond the artboard boundary remain visible.
export { BLEED } from '../utils/canvasGeometry';

// Custom "T" cursor SVG for text placement mode
const TEXT_PLACEMENT_CURSOR = (() => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M6 3h12M12 3v18' stroke='white' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M6 3h12M12 3v18' stroke='%23333' stroke-width='1.5' stroke-linecap='round' fill='none'/></svg>`;
  return `url("data:image/svg+xml,${svg}") 12 3, text`;
})();

const SELECTION_COLOR = '#4F46E5';
const GUIDE_COLOR = '#EC4899';
const THUMBNAIL_WIDTH = 400;

// Smart guides: snap distance on screen, independent of zoom.
const SNAP_SCREEN_PX = 6;
// A marquee smaller than this on both axes is a click, not a selection.
const LASSO_MIN_PX = 5;
// A press that travels further than this before release is a drag of some
// kind (marquee, view pan), not a click on the background.
const CLICK_TRAVEL_TOLERANCE_PX = 4;
// Smallest box (screen px) a transform may shrink a node to; keeps a resize
// from collapsing an element into something that cannot be grabbed again.
const MIN_TRANSFORM_BOX_PX = 4;

const CORNER_ANCHORS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const ALL_ANCHORS = ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const NO_ANCHORS: string[] = [];
const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const NO_ROTATION_SNAPS: number[] = [];

function limitTransformBox(oldBox: TransformBox, newBox: TransformBox): TransformBox {
  const tooSmall =
    Math.abs(newBox.width) < MIN_TRANSFORM_BOX_PX || Math.abs(newBox.height) < MIN_TRANSFORM_BOX_PX;
  return tooSmall ? oldBox : newBox;
}

function boxesIntersect(a: Box, b: Box): boolean {
  return !(a.x > b.x + b.width || a.x + a.width < b.x || a.y > b.y + b.height || a.y + a.height < b.y);
}

function isPrimaryButton(evt: Event | undefined): boolean {
  return !evt || !('button' in evt) || (evt as MouseEvent).button === 0;
}

// Force a text node to measure itself again with the fonts that are now
// loaded. Konva caches line widths until a text attribute changes.
function remeasureTextNode(node: Konva.Node): void {
  if (node.getClassName() !== 'Text') return;
  const textNode = node as Konva.Text;
  const text = textNode.text();
  textNode.text(`${text}​`);
  textNode.text(text);
}

function waitForFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) resolve();
      else requestAnimationFrame(() => step(remaining - 1));
    };
    step(count);
  });
}

interface DragSession {
  // The element under the pointer. Every other node is positioned from it.
  leadId: string;
  // Node positions (canvas units) of every element moving in this drag.
  startNodePositions: Map<string, Position>;
  // Selected elements that must stay put (locked or hidden), with the
  // position to hold them at.
  pinnedNodePositions: Map<string, Position>;
  // Bounding box of the moving elements at drag start, for smart guides.
  startBox: Box | null;
  targets: Box[];
  lockAxis: 'x' | 'y' | null;
}

interface LassoSession {
  startX: number;
  startY: number;
  rect: Box | null;
  moved: boolean;
  // Shift adds the marquee hits to the selection that existed at its start.
  additive: boolean;
  baseSelection: string[];
}

export const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(
  { template, elements, scale = 0.5, canvasColor, viewport, onTextChange, selectedElementIds = [], onSelectElement, onElementUpdate, onElementsUpdate, onImageDrop, onImageLoad, onBeforeExport, entranceAnimationPhase, textPlacementMode, onPlaceText, onEditingChange, onBackgroundTouchStart, onBackgroundPanStart, onTransformingChange, interactionMode = 'studio', onElementTransientUpdate, onInteractionCommit, onStoriesDragStateChange, onStoriesDeleteElement, storiesTrashRef, onStoriesTextEdit, storiesTextEditActive = false },
  ref
) {
  const { t } = useTranslation('editor');
  const isStoriesMode = interactionMode === 'stories';
  const stageRef = useRef<Konva.Stage>(null);
  const contentLayerRef = useRef<Konva.Layer>(null);
  const uiLayerRef = useRef<Konva.Layer>(null);
  const transformerRefsMap = useRef<Map<string, Konva.Transformer>>(new Map());
  const multiTransformerRef = useRef<Konva.Transformer>(null);
  const nodesRef = useRef<Map<string, Konva.Node>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<Box | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const shiftPressedRef = useRef(false);
  const dragSessionRef = useRef<DragSession | null>(null);
  const lassoRef = useRef<LassoSession | null>(null);
  const lassoCleanupRef = useRef<(() => void) | null>(null);
  // Where the current press on empty stage started, in page coordinates.
  const stagePressRef = useRef<{ x: number; y: number } | null>(null);

  // Stage layout: either the Studio viewport or the fixed artboard + bleed box.
  const originX = viewport ? viewport.originX : BLEED * scale;
  const originY = viewport ? viewport.originY : BLEED * scale;
  const stageWidth = viewport ? viewport.width : (template.width + BLEED * 2) * scale;
  const stageHeight = viewport ? viewport.height : (template.height + BLEED * 2) * scale;

  const elementById = useMemo(() => new Map(elements.map((element) => [element.id, element])), [elements]);

  const editingElement = (() => {
    const element = editingId ? elementById.get(editingId) : undefined;
    return element?.type === 'text' ? element : null;
  })();
  const isEditing = editingElement !== null;

  // Always-current selection for handlers that can fire before React has
  // re-rendered with the latest props (rapid clicks, drag start).
  const selectedIdsRef = useRef(selectedElementIds);
  useLayoutEffect(() => {
    selectedIdsRef.current = selectedElementIds;
  }, [selectedElementIds]);

  const clearGuides = () => setGuides((previous) => (previous.length === 0 ? previous : []));

  const touch = useTouchGestures({
    isStoriesMode,
    storiesTextEditActive,
    isEditing,
    scale,
    template,
    elements,
    selectedIdsRef,
    nodesRef,
    onDragsStopped: () => {
      dragSessionRef.current = null;
      clearGuides();
    },
    onElementTransientUpdate,
    onInteractionCommit,
    onStoriesDragStateChange,
    onStoriesDeleteElement,
    storiesTrashRef,
  });

  // Track Shift: axis-locks a drag and enables rotation snapping.
  useEffect(() => {
    const update = (pressed: boolean) => {
      shiftPressedRef.current = pressed;
      setIsShiftPressed(pressed);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') update(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') update(false);
    };
    // A key released while another window has focus never reports keyup.
    const handleBlur = () => update(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // --- Web fonts ---
  //
  // A canvas draws with a web font only once it is loaded and never repaints
  // by itself when it arrives. Request every face the document needs up
  // front, then re-measure and repaint the text whenever a face finishes.

  const refreshTextMetrics = useEventCallback(() => {
    nodesRef.current.forEach(remeasureTextNode);
    transformerRefsMap.current.forEach((transformer) => transformer.forceUpdate());
    multiTransformerRef.current?.forceUpdate();
    contentLayerRef.current?.batchDraw();
    uiLayerRef.current?.batchDraw();
  });

  const fontRequests = useMemo(() => collectFontRequests(elements), [elements]);
  const fontsKey = fontRequestsKey(fontRequests);
  const loadDocumentFonts = useEventCallback(() => requestFonts(fontRequests));

  useEffect(() => {
    let cancelled = false;
    void loadDocumentFonts().then(() => {
      if (!cancelled) refreshTextMetrics();
    });
    return () => {
      cancelled = true;
    };
  }, [fontsKey, loadDocumentFonts, refreshTextMetrics]);

  useEffect(() => {
    if (!('fonts' in document)) return;
    const fontSet = document.fonts;
    fontSet.addEventListener('loadingdone', refreshTextMetrics);

    // The editor's font stylesheets are injected at runtime and can arrive
    // after the faces were first requested, when the browser did not know
    // them yet. Ask again whenever a stylesheet finishes loading. (`load` does
    // not bubble, hence the capture listener.)
    const handleResourceLoad = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLLinkElement && target.rel === 'stylesheet') {
        void loadDocumentFonts().then(refreshTextMetrics);
      }
    };
    document.addEventListener('load', handleResourceLoad, true);

    return () => {
      fontSet.removeEventListener('loadingdone', refreshTextMetrics);
      document.removeEventListener('load', handleResourceLoad, true);
    };
  }, [loadDocumentFonts, refreshTextMetrics]);

  // --- Export ---

  const exportArtboard = useEventCallback((options: { mimeType: string; quality: number; outputWidth: number }): string => {
    onBeforeExport?.();
    const stage = stageRef.current;
    const layer = contentLayerRef.current;
    if (!stage || !layer) return '';

    // The text being edited inline is hidden on the canvas; it still belongs
    // in the exported image.
    const hiddenForEditing = editingId ? nodesRef.current.get(editingId) : undefined;
    hiddenForEditing?.visible(true);

    // Render from a canonical view (artboard at the origin, 1 canvas unit per
    // pixel) rather than from the current zoom and pan. The image is then
    // identical whatever the view is: no resampling of shapes drawn through
    // Konva's buffer canvas at a fractional offset, and no clipping when the
    // artboard origin is scrolled off-screen.
    const view = { x: stage.x(), y: stage.y(), scaleX: stage.scaleX(), scaleY: stage.scaleY() };
    stage.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

    try {
      return layer.toDataURL({
        x: 0,
        y: 0,
        width: template.width,
        height: template.height,
        pixelRatio: options.outputWidth / template.width,
        mimeType: options.mimeType,
        quality: options.quality,
      });
    } catch (error) {
      console.error('Canvas export failed:', error);
      return '';
    } finally {
      stage.setAttrs(view);
      hiddenForEditing?.visible(false);
    }
  });

  const whenReadyForExport = useEventCallback(async () => {
    await ensureTextFonts(elements, EDITOR_FONT_WAIT_MS);
    refreshTextMetrics();
    // Two frames: one for React's latest commit to reach the Konva nodes, one
    // for the repaint.
    await waitForFrames(2);
  });

  useImperativeHandle(ref, () => ({
    exportImage: () => exportArtboard({ mimeType: 'image/png', quality: 1, outputWidth: template.width }),
    exportFullresPreview: () => exportArtboard({ mimeType: 'image/jpeg', quality: 0.88, outputWidth: template.width }),
    exportThumbnail: () => exportArtboard({ mimeType: 'image/jpeg', quality: 0.7, outputWidth: THUMBNAIL_WIDTH }),
    getNodesMap: () => nodesRef.current,
    getLayerNode: () => contentLayerRef.current,
    isDragging: () => Konva.isDragging(),
    whenReadyForExport,
  }), [exportArtboard, template.width, whenReadyForExport]);

  // Attach transformers to their nodes whenever the selection or the
  // document changes (a font or text change resizes a node without telling
  // its transformer).
  useEffect(() => {
    if (!isEditing) {
      selectedElementIds.forEach((id) => {
        const transformer = transformerRefsMap.current.get(id);
        const node = nodesRef.current.get(id);
        if (transformer && node) transformer.nodes([node]);
      });

      if (selectedElementIds.length > 1 && multiTransformerRef.current) {
        const selectedNodes = selectedElementIds
          .map((id) => nodesRef.current.get(id))
          .filter((node): node is Konva.Node => !!node);
        multiTransformerRef.current.nodes(selectedNodes);
      }
    }

    uiLayerRef.current?.batchDraw();
  }, [selectedElementIds, isEditing, elements]);

  // --- Inline text editing (Studio) ---

  const startEditing = (id: string) => {
    setEditingId(id);
    onEditingChange?.(true);
  };

  const finishEditing = () => {
    setEditingId(null);
    onEditingChange?.(false);
  };

  const handleTextCommit = (text: string) => {
    const id = editingId;
    finishEditing();
    if (id) onTextChange?.(id, text);
  };

  const handleTextDoubleClick = useEventCallback((id: string) => {
    const element = elementById.get(id);
    if (!element || element.type !== 'text') return;

    // Stories mode never uses the inline editor — route double-taps to the
    // fullscreen text editor instead.
    if (isStoriesMode) {
      if (!element.locked && !storiesTextEditActive) onStoriesTextEdit?.(element);
      return;
    }
    if (!onTextChange) return;
    startEditing(id);
  });

  // --- Element selection ---

  // Stories tap-to-edit (E2-c): remembers whether the current press started
  // on the element that was ALREADY the single selection. handlePress fires
  // twice per tap gesture (touchstart = press, Konva tap = release); the
  // release promotes a press on an already-selected text element to the
  // fullscreen text editor. Konva only fires `tap` when the finger did not
  // drag, so moving a selected text never opens the editor.
  const storiesPressWasSelectedRef = useRef(false);

  const handlePress = useEventCallback((id: string, event: ElementPointerEvent) => {
    if (!onSelectElement) return;
    if (touch.isInteractionBlocked()) {
      event.cancelBubble = true;
      return;
    }

    const evt = event.evt as MouseEvent | TouchEvent | undefined;
    const button = evt && 'button' in evt ? evt.button : 0;
    // The middle button pans the view.
    if (button === 1) return;

    const current = selectedIdsRef.current;

    if (isStoriesMode) {
      const evtType = evt?.type ?? '';
      if (evtType === 'touchstart' || evtType === 'mousedown') {
        storiesPressWasSelectedRef.current = current.length === 1 && current[0] === id;
      } else {
        // Release phase (Konva 'tap'): a second tap on the selected text
        // element opens the fullscreen editor (Instagram behavior).
        const element = elementById.get(id);
        if (
          storiesPressWasSelectedRef.current &&
          element?.type === 'text' &&
          !element.locked &&
          onStoriesTextEdit
        ) {
          event.cancelBubble = true;
          onStoriesTextEdit(element);
          return;
        }
      }
    }

    const isAlreadySelected = current.includes(id);

    // Secondary button: make sure the element under the pointer is selected,
    // but never shrink a selection the pointer is already inside.
    if (button === 2) {
      if (!isAlreadySelected) onSelectElement([id]);
      return;
    }

    const shiftKey = !!evt && 'shiftKey' in evt && evt.shiftKey;
    if (shiftKey) {
      // Shift+Click: toggle selection
      onSelectElement(isAlreadySelected ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
    } else if (!isAlreadySelected || current.length === 1) {
      // Regular press: select only this element, unless it is already part
      // of a multi-selection (kept so the whole group can be dragged).
      onSelectElement([id]);
    }
  });

  // A click that did not turn into a drag on one member of a multi-selection
  // narrows the selection to that element.
  const handleClick = useEventCallback((id: string, event: ElementPointerEvent) => {
    if (!onSelectElement || isStoriesMode || touch.isInteractionBlocked()) return;
    const evt = event.evt as MouseEvent | undefined;
    if (!evt || evt.button !== 0 || evt.shiftKey) return;
    const current = selectedIdsRef.current;
    if (current.length > 1 && current.includes(id)) onSelectElement([id]);
  });

  // --- Dragging (single and multi-selection) ---

  // With a multi-selection the group transformer makes Konva drag every
  // attached node, so each of them reports its own dragstart/move/end. One
  // session, owned by the element under the pointer, positions and commits
  // them all; the reports from the others are ignored.
  const handleDragStart = useEventCallback((id: string, event: ElementDragEvent) => {
    if (touch.isInteractionBlocked()) {
      touch.stopActiveDrags();
      return;
    }

    const active = dragSessionRef.current;
    const isFollower =
      !!active
      && active.leadId !== id
      && (active.startNodePositions.has(id) || active.pinnedNodePositions.has(id));
    if (isFollower) return;

    if (isStoriesMode) touch.beginStoriesDrag(id);

    const current = selectedIdsRef.current;
    const isAlreadySelected = current.includes(id);
    if (!isAlreadySelected) onSelectElement?.([id]);

    // The dragged element always moves; the rest of a multi-selection follows
    // unless it is locked or hidden.
    const startNodePositions = new Map<string, Position>();
    const pinnedNodePositions = new Map<string, Position>();
    startNodePositions.set(id, { x: event.target.x(), y: event.target.y() });
    if (isAlreadySelected && current.length > 1) {
      current.forEach((selectedId) => {
        if (selectedId === id) return;
        const element = elementById.get(selectedId);
        const node = nodesRef.current.get(selectedId);
        if (!element || !node) return;
        const position = { x: node.x(), y: node.y() };
        if (element.locked || !(element.visible ?? true)) pinnedNodePositions.set(selectedId, position);
        else startNodePositions.set(selectedId, position);
      });
    }

    const layer = contentLayerRef.current;
    const boxOf = (node: Konva.Node): Box =>
      node.getClientRect({ relativeTo: layer ?? undefined, skipShadow: true });
    const movingBoxes: Box[] = [];
    startNodePositions.forEach((_, movingId) => {
      const node = movingId === id ? event.target : nodesRef.current.get(movingId);
      if (node) movingBoxes.push(boxOf(node));
    });

    dragSessionRef.current = {
      leadId: id,
      startNodePositions,
      pinnedNodePositions,
      startBox: isStoriesMode ? null : unionBox(movingBoxes),
      targets: isStoriesMode
        ? []
        : elements
            .filter((element) => !startNodePositions.has(element.id) && (element.visible ?? true))
            .flatMap((element) => {
              const node = nodesRef.current.get(element.id);
              return node ? [boxOf(node)] : [];
            }),
      lockAxis: null,
    };
  });

  const handleDragMove = useEventCallback((id: string, event: ElementDragEvent) => {
    const session = dragSessionRef.current;
    if (!session || session.leadId !== id) return;

    if (isStoriesMode) {
      if (touch.isStoriesDragging(id)) touch.moveStoriesDrag(id, event);
      return;
    }

    const start = session.startNodePositions.get(id);
    if (!start) return;
    let dx = event.target.x() - start.x;
    let dy = event.target.y() - start.y;

    // Shift constrains the drag to its dominant axis.
    if (shiftPressedRef.current) {
      if (!session.lockAxis && Math.abs(dx) !== Math.abs(dy)) {
        session.lockAxis = Math.abs(dx) >= Math.abs(dy) ? 'y' : 'x';
      }
      if (session.lockAxis === 'x') dx = 0;
      else if (session.lockAxis === 'y') dy = 0;
    } else {
      session.lockAxis = null;
    }

    // Smart guides, unless Cmd/Ctrl is held for free placement.
    let nextGuides: SnapGuide[] = [];
    const evt = event.evt as unknown as MouseEvent | undefined;
    const snapSuppressed = !!evt && (evt.metaKey || evt.ctrlKey);
    if (session.startBox && !snapSuppressed) {
      const snap = computeSnap(
        { ...session.startBox, x: session.startBox.x + dx, y: session.startBox.y + dy },
        session.targets,
        template,
        {
          threshold: SNAP_SCREEN_PX / scale,
          lockX: session.lockAxis === 'x',
          lockY: session.lockAxis === 'y',
        },
      );
      dx += snap.dx;
      dy += snap.dy;
      nextGuides = snap.guides;
    }

    session.startNodePositions.forEach((position, movingId) => {
      const node = movingId === id ? event.target : nodesRef.current.get(movingId);
      node?.position({ x: position.x + dx, y: position.y + dy });
    });
    session.pinnedNodePositions.forEach((position, pinnedId) => {
      nodesRef.current.get(pinnedId)?.position(position);
    });

    setGuides((previous) => (previous.length === 0 && nextGuides.length === 0 ? previous : nextGuides));
  });

  const handleDragEnd = useEventCallback((id: string, event: ElementDragEvent) => {
    const session = dragSessionRef.current;

    // Only the element that owns the drag commits. Anything else is a
    // follower the owner covers, or a drag that was cancelled before it moved.
    if (!session || session.leadId !== id) return;

    dragSessionRef.current = null;
    clearGuides();

    // Dropped on the Stories trash: the element is gone, nothing to commit.
    if (isStoriesMode && touch.isStoriesDragging(id) && touch.endStoriesDrag(id, event)) return;

    const positions = new Map<string, Position>();
    session.startNodePositions.forEach((_, movedId) => {
      const element = elementById.get(movedId);
      const node = movedId === id ? event.target : nodesRef.current.get(movedId);
      if (!element || !node) return;
      // Star/Circle nodes are center-origin; elements store the top-left.
      positions.set(movedId, nodePositionToElementPosition(element, { x: node.x(), y: node.y() }));
    });
    session.pinnedNodePositions.forEach((position, pinnedId) => {
      nodesRef.current.get(pinnedId)?.position(position);
    });
    if (positions.size === 1) {
      const [[movedId, position]] = positions;
      onElementUpdate?.(movedId, position);
    } else if (positions.size > 1) {
      onElementsUpdate?.([...positions.keys()], (element) => positions.get(element.id) ?? {});
    }
  });

  // --- Transform (resize / rotate) ---

  // A degenerate transform can report NaN or zero scale; never let that
  // reach the document.
  const sanitizeTransform = (snapshot: NodeTransformSnapshot): NodeTransformSnapshot => ({
    ...snapshot,
    scaleX: Number.isFinite(snapshot.scaleX) && snapshot.scaleX !== 0 ? Math.abs(snapshot.scaleX) : 1,
    scaleY: Number.isFinite(snapshot.scaleY) && snapshot.scaleY !== 0 ? Math.abs(snapshot.scaleY) : 1,
    rotation: Number.isFinite(snapshot.rotation) ? snapshot.rotation : 0,
  });

  const handleTransformEnd = useEventCallback((id: string, event: Konva.KonvaEventObject<Event>) => {
    // The group transformer commits every member of a multi-selection at once.
    const current = selectedIdsRef.current;
    if (current.length > 1 && current.includes(id)) return;

    const element = elementById.get(id);
    if (!element) return;

    // Scale is folded into width/height (or fontSize) and reset on the node,
    // so the value coming back through props is not applied twice.
    const snapshot = sanitizeTransform(readNodeTransform(event.target));
    resetNodeScale(event.target);
    onElementUpdate?.(id, buildTransformUpdates(element, snapshot));
  });

  const handleMultiTransformEnd = () => {
    if (!onElementsUpdate) return;

    const currentIds = selectedIdsRef.current;

    // Phase 1: collect ALL node transforms BEFORE resetting any scale, so
    // resetting one node cannot affect how the transformer reads another.
    const nodeData = new Map<string, NodeTransformSnapshot>();
    currentIds.forEach((id) => {
      const node = nodesRef.current.get(id);
      if (node) nodeData.set(id, sanitizeTransform(readNodeTransform(node)));
    });

    // Phase 2: reset every node scale.
    currentIds.forEach((id) => {
      const node = nodesRef.current.get(id);
      if (node) resetNodeScale(node);
    });

    // Phase 3: build the document updates from the collected data.
    const updatesMap = new Map<string, Partial<CanvasElement>>();
    currentIds.forEach((id) => {
      const data = nodeData.get(id);
      const element = elementById.get(id);
      if (data && element) updatesMap.set(id, buildTransformUpdates(element, data));
    });

    onElementsUpdate(currentIds, (element) => updatesMap.get(element.id) || {});
  };

  const registerNode = useEventCallback((id: string, node: Konva.Node | null) => {
    if (node) nodesRef.current.set(id, node);
    else nodesRef.current.delete(id);
  });

  const handlers = useMemo<ElementNodeHandlers>(
    () => ({
      registerNode,
      onPress: handlePress,
      onClick: handleClick,
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onTransformEnd: handleTransformEnd,
    }),
    [registerNode, handlePress, handleClick, handleDragStart, handleDragMove, handleDragEnd, handleTransformEnd],
  );

  // --- Marquee (lasso) selection ---

  const completeLasso = useEventCallback((session: LassoSession) => {
    if (!onSelectElement || !session.moved || !session.rect) return;

    const marquee = session.rect;
    const hits = elements
      // Locked or hidden elements are not selectable by pointer.
      .filter((element) => !element.locked && (element.visible ?? true))
      .filter((element) => {
        const node = nodesRef.current.get(element.id);
        return !!node && boxesIntersect(marquee, node.getClientRect({ skipShadow: true }));
      })
      .map((element) => element.id);

    onSelectElement(session.additive ? [...new Set([...session.baseSelection, ...hits])] : hits);
  });

  const beginLasso = (stage: Konva.Stage, start: Position, additive: boolean) => {
    lassoCleanupRef.current?.();

    const session: LassoSession = {
      startX: start.x,
      startY: start.y,
      rect: null,
      moved: false,
      additive,
      baseSelection: [...selectedIdsRef.current],
    };
    lassoRef.current = session;
    setSelectionRect({ x: start.x, y: start.y, width: 0, height: 0 });

    const handleMove = (event: MouseEvent) => {
      stage.setPointersPositions(event);
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const rect = {
        x: Math.min(session.startX, pointer.x),
        y: Math.min(session.startY, pointer.y),
        width: Math.abs(pointer.x - session.startX),
        height: Math.abs(pointer.y - session.startY),
      };
      session.rect = rect;
      if (rect.width >= LASSO_MIN_PX || rect.height >= LASSO_MIN_PX) session.moved = true;
      setSelectionRect(rect);
    };

    const listeners = new AbortController();
    const stop = () => {
      listeners.abort();
      lassoCleanupRef.current = null;
      lassoRef.current = null;
      setSelectionRect(null);
    };
    const handleUp = () => {
      stop();
      completeLasso(session);
    };

    // Listening on window: releasing the button outside the stage must still
    // end the marquee.
    const { signal } = listeners;
    window.addEventListener('mousemove', handleMove, { signal });
    window.addEventListener('mouseup', handleUp, { signal });
    window.addEventListener('blur', stop, { signal });
    lassoCleanupRef.current = stop;
  };

  useEffect(() => () => lassoCleanupRef.current?.(), []);

  const pointerToCanvas = (pointer: Position): Position => ({
    x: (pointer.x - originX) / scale,
    y: (pointer.y - originY) / scale,
  });

  // --- Image drop ---

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const stage = stageRef.current;
    if (!onImageDrop || !stage) return;

    const imageFiles = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    stage.setPointersPositions(e.nativeEvent);
    const pointer = stage.getPointerPosition();
    const dropPoint = pointer ? pointerToCanvas(pointer) : undefined;
    // Only honor a drop point that lies on the artboard.
    const position =
      dropPoint
      && dropPoint.x >= 0 && dropPoint.y >= 0
      && dropPoint.x <= template.width && dropPoint.y <= template.height
        ? dropPoint
        : undefined;

    imageFiles.forEach((imageFile) => {
      const objectUrl = URL.createObjectURL(imageFile);
      const img = new Image();
      img.onload = () => {
        onImageDrop(imageFile, img.width, img.height, position);
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the canvas container itself
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
    }
  };

  const isMultiSelection = selectedElementIds.length > 1;
  // Hidden elements can be selected from the layer list; they have no frame.
  const framedElements = isEditing
    ? []
    : selectedElementIds.flatMap((id) => {
        const element = elementById.get(id);
        return element && (element.visible ?? true) ? [element] : [];
      });

  return (
    <div
      className="relative"
      style={{ width: stageWidth, height: stageHeight, cursor: textPlacementMode ? TEXT_PLACEMENT_CURSOR : undefined }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 bg-blue-500/20 border-4 border-blue-500 border-dashed z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white px-6 py-3 rounded-lg shadow-lg">
            <p className="text-blue-600 font-semibold text-lg">{t('dropImage')}</p>
          </div>
        </div>
      )}
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={scale}
        scaleY={scale}
        x={originX}
        y={originY}
        listening={entranceAnimationPhase !== 'loading' && entranceAnimationPhase !== 'animating'}
        onClick={(e) => {
          const stage = e.target.getStage();
          // Only the empty stage counts as background. (A shape is never the
          // background, whatever its fill.)
          if (!stage || e.target !== stage || !isPrimaryButton(e.evt)) return;
          // The release that ends a marquee or a view pan also produces a
          // click; only a press that stayed in place is one.
          const press = stagePressRef.current;
          stagePressRef.current = null;
          const release = e.evt as MouseEvent;
          if (
            press
            && Math.hypot(release.clientX - press.x, release.clientY - press.y) > CLICK_TRAVEL_TOLERANCE_PX
          ) {
            return;
          }

          // Text placement mode: place text at click position
          if (textPlacementMode && onPlaceText) {
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const point = pointerToCanvas(pointer);
            // Only allow placement within the canvas bounds
            if (point.x < 0 || point.y < 0 || point.x > template.width || point.y > template.height) return;
            const newId = onPlaceText(point.x, point.y);
            if (newId) startEditing(newId);
            return;
          }

          // Deselect when clicking on empty area
          onSelectElement?.([]);
        }}
        onMouseDown={(e) => {
          // Marquee selection starts on empty stage. It is a Studio-only
          // interaction (multi-select is not part of the Stories feature set).
          const stage = e.target.getStage();
          if (!stage || e.target !== stage || !isPrimaryButton(e.evt)) return;
          stagePressRef.current = { x: e.evt.clientX, y: e.evt.clientY };
          if (isEditing || textPlacementMode || isStoriesMode) return;

          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          // In the Studio viewport, empty space beyond the bleed band pans the
          // view instead of starting a marquee.
          if (viewport && !isInsideBleedZone(pointerToCanvas(pointer), template, BLEED)) {
            onBackgroundPanStart?.(e.evt.clientX, e.evt.clientY);
            return;
          }

          beginLasso(stage, pointer, e.evt.shiftKey);
        }}
        onMouseMove={(e) => {
          // Show that an element can be picked up. The transformer manages the
          // cursor over its own handles.
          const stage = e.target.getStage();
          if (!stage || isStoriesMode || textPlacementMode) return;
          if (e.target !== stage && e.target.findAncestor('Transformer')) return;
          const cursor = e.target !== stage && e.target.draggable() ? 'move' : '';
          const container = stage.container();
          if (container.style.cursor !== cursor) container.style.cursor = cursor;
        }}
        onTouchStart={(e) => {
          // Cancel Konva event processing during a multi-finger gesture so it
          // cannot select or drag an element.
          if (touch.handleStageTouchStart(e.evt.touches?.length ?? 0)) {
            e.cancelBubble = true;
            return;
          }

          // A single finger on empty stage pans the view on touch devices.
          const isBackground = e.target === e.target.getStage();
          if (isBackground && !textPlacementMode && !isEditing && onBackgroundTouchStart) {
            const first = e.evt.touches?.[0];
            if (first) onBackgroundTouchStart(first.clientX, first.clientY);
          }
        }}
        onTouchMove={(e) => {
          if (touch.handleStageTouchMove(e.evt.touches?.length ?? 0)) {
            e.cancelBubble = true;
          }
        }}
        onTouchEnd={(e) => touch.handleStageTouchEnd(e.evt.touches?.length ?? 0)}
        onTouchCancel={touch.handleStageTouchCancel}
      >
        {/* Document content only: exports read this layer, so selection
            frames and guides can never end up in an image. */}
        <Layer ref={contentLayerRef}>
          {/* Stage background (BLEED area) - slightly lighter than outer background */}
          <Rect
            x={-BLEED}
            y={-BLEED}
            width={template.width + BLEED * 2}
            height={template.height + BLEED * 2}
            fill="#1a1a1a"
            listening={false}
          />
          {/* Artboard background */}
          <Rect
            x={0}
            y={0}
            width={template.width}
            height={template.height}
            fill={canvasColor}
            listening={false}
          />
          {/* Clip elements to artboard — transformers stay outside */}
          <Group
            clipX={0}
            clipY={0}
            clipWidth={template.width}
            clipHeight={template.height}
            listening={!textPlacementMode}
          >
            {elements.map((element) => {
              if (element.type === 'shape') {
                return <ShapeRenderer key={element.id} shape={element as ShapeElement} handlers={handlers} />;
              }
              if (element.type === 'text') {
                return (
                  <TextRenderer
                    key={element.id}
                    textElement={element as TextElement}
                    handlers={handlers}
                    onDoubleClick={handleTextDoubleClick}
                    isEditing={element.id === editingId}
                  />
                );
              }
              if (element.type === 'image') {
                return (
                  <ImageRenderer
                    key={element.id}
                    imageElement={element as ImageElement}
                    handlers={handlers}
                    onImageLoad={onImageLoad}
                  />
                );
              }
              return null;
            })}
          </Group>
        </Layer>
        {/* Editing chrome: guides, selection frames, marquee. */}
        <Layer ref={uiLayerRef}>
          {/* Stories mode: center snap guides while dragging (IG-style thin lines) */}
          {isStoriesMode && touch.snapGuides.v && (
            <Line
              points={[template.width / 2, 0, template.width / 2, template.height]}
              stroke="#FFFFFF"
              strokeWidth={1.5 / scale}
              opacity={0.9}
              listening={false}
            />
          )}
          {isStoriesMode && touch.snapGuides.h && (
            <Line
              points={[0, template.height / 2, template.width, template.height / 2]}
              stroke="#FFFFFF"
              strokeWidth={1.5 / scale}
              opacity={0.9}
              listening={false}
            />
          )}
          {/* Studio smart guides while dragging */}
          {guides.map((guide) => (
            <Line
              key={`${guide.orientation}-${guide.position}`}
              points={
                guide.orientation === 'vertical'
                  ? [guide.position, guide.start, guide.position, guide.end]
                  : [guide.start, guide.position, guide.end, guide.position]
              }
              stroke={GUIDE_COLOR}
              strokeWidth={1}
              strokeScaleEnabled={false}
              listening={false}
            />
          ))}
          {framedElements.map((element) => {
            const isText = element.type === 'text';
            // Stories mode shows the selection frame only: no resize anchors,
            // no rotate handle (finger-sized gestures replace them in E2-b).
            // Locked elements can be selected from the layer list but not
            // transformed.
            const handlesDisabled = isStoriesMode || isMultiSelection || !!element.locked;
            return (
              <Transformer
                key={`transformer-${element.id}`}
                ref={(transformer) => {
                  if (transformer) transformerRefsMap.current.set(element.id, transformer);
                  else transformerRefsMap.current.delete(element.id);
                }}
                borderStroke={SELECTION_COLOR}
                borderStrokeWidth={2}
                borderDash={[4, 4]}
                anchorStroke={SELECTION_COLOR}
                anchorFill="#FFFFFF"
                anchorSize={8}
                enabledAnchors={handlesDisabled ? NO_ANCHORS : isText ? CORNER_ANCHORS : ALL_ANCHORS}
                rotateEnabled={!handlesDisabled}
                rotationSnaps={isShiftPressed ? ROTATION_SNAPS : NO_ROTATION_SNAPS}
                rotationSnapTolerance={5}
                // Corner handles keep the proportions of text and images; the
                // side handles of an image still stretch one dimension.
                keepRatio={isText || element.type === 'image'}
                flipEnabled={false}
                boundBoxFunc={limitTransformBox}
                onTransformStart={() => onTransformingChange?.(true)}
                onTransformEnd={() => onTransformingChange?.(false)}
              />
            );
          })}
          {/* Group transformer for multi-selection resize/rotate */}
          {!isEditing && isMultiSelection && (
            <Transformer
              ref={multiTransformerRef}
              borderStroke={SELECTION_COLOR}
              borderStrokeWidth={1}
              borderDash={[6, 3]}
              anchorStroke={SELECTION_COLOR}
              anchorFill="#FFFFFF"
              anchorSize={10}
              enabledAnchors={isStoriesMode ? NO_ANCHORS : CORNER_ANCHORS}
              rotateEnabled={!isStoriesMode}
              rotationSnaps={isShiftPressed ? ROTATION_SNAPS : NO_ROTATION_SNAPS}
              rotationSnapTolerance={5}
              keepRatio={true}
              flipEnabled={false}
              boundBoxFunc={limitTransformBox}
              onTransformStart={() => onTransformingChange?.(true)}
              onTransformEnd={() => { onTransformingChange?.(false); handleMultiTransformEnd(); }}
            />
          )}
          {selectionRect && (
            <Rect
              x={(selectionRect.x - originX) / scale}
              y={(selectionRect.y - originY) / scale}
              width={selectionRect.width / scale}
              height={selectionRect.height / scale}
              fill="rgba(79, 70, 229, 0.1)"
              stroke={SELECTION_COLOR}
              strokeWidth={1}
              strokeScaleEnabled={false}
              dash={[4, 4]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
      {editingElement && (
        <InlineTextEditor
          key={editingElement.id}
          element={editingElement}
          scale={scale}
          originX={originX}
          originY={originY}
          onCommit={handleTextCommit}
          onCancel={finishEditing}
        />
      )}
    </div>
  );
});
