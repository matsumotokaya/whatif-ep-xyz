import { useRef, useState, type RefObject } from 'react';
import type { CanvasElement, ImageElement, ShapeElement, Template } from '../types/template';
import type { CanvasRef } from '../components/Canvas';
import type { DocumentStore } from '../utils/documentStore';
import type { Position } from '../utils/konvaCommit';
import {
  CASCADE_OFFSET,
  cloneElements,
  createElementId,
  createImageElement,
  createShapeElement,
  createTextElement,
  type TextDefaults,
} from '../utils/elementFactory';
import { readElementClipboard, resolvePasteSource, writeElementClipboard } from '../utils/editorClipboard';
import { showEditorToast } from '../utils/editorToasts';
import { getFitToCanvasPlacement } from '../utils/canvasPlacement';
import { createSilhouetteBlob } from '../utils/imageShadow';
import { insertUserImageRecord } from '../utils/libraryAssets';
import { dataUrlToBlob, getExtensionFromMime, isDataUrlImage } from '../utils/storage';
import { uploadAsset } from '../utils/r2Upload';
import { buildUserUploadKey, resolveElementSrc } from '@/lib/asset';
import { centeredPlacement, estimateTextBlockSize } from '../stories/storiesTextTools';
import { useEventCallback } from './useEventCallback';

interface UseEditorActionsOptions {
  store: DocumentStore;
  canvasRef: RefObject<CanvasRef | null>;
  template: Template;
  selectedElementIds: string[];
  setSelection: (ids: string[]) => void;
  textDefaults: TextDefaults;
  setTextDefaults: (update: (previous: TextDefaults) => TextDefaults) => void;
  // Signed-in user id, or null for a guest.
  userId: string | null;
  // Save the document now, without waiting (after adding/removing elements).
  saveSoon: () => void;
  // Uploading needs an account; ask the guest to log in.
  onLoginRequired: () => void;
  t: (key: string) => string;
}

type ShapeType = ShapeElement['shapeType'];

const isMovable = (element: CanvasElement) => !element.locked;

// Arrow-key presses closer together than this are one nudge (and one undo
// step); a longer pause starts a new one.
const NUDGE_SESSION_GAP_MS = 800;

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The pasted image could not be read.'));
    };
    image.src = url;
  });
}

// Every way the user changes the open document, expressed as stable callbacks
// over the document store. Nothing here holds document state of its own.
export function useEditorActions({
  store,
  canvasRef,
  template,
  selectedElementIds,
  setSelection,
  textDefaults,
  setTextDefaults,
  userId,
  saveSoon,
  onLoginRequired,
  t,
}: UseEditorActionsOptions) {
  const [isGeneratingShadow, setIsGeneratingShadow] = useState(false);
  // Repeated pastes of the same copy fan out instead of stacking exactly.
  const pasteCountRef = useRef<{ token: string | null; count: number }>({ token: null, count: 0 });
  const nudgeSessionRef = useRef({ id: 0, lastAt: 0 });

  const elementsNow = () => store.getState().elements;
  const selectedNow = () => {
    const selected = new Set(selectedElementIds);
    return elementsNow().filter((element) => selected.has(element.id));
  };

  // --- Selection ---

  const selectElements = useEventCallback((ids: string[]) => {
    setSelection(ids);
    if (ids.length !== 1) return;
    const element = elementsNow().find((el) => el.id === ids[0]);
    if (element?.type !== 'text') return;
    // The selected text becomes the template for the next text added.
    setTextDefaults(() => ({
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      letterSpacing: element.letterSpacing ?? 0,
      lineHeight: element.lineHeight ?? 1,
      fill: element.fill,
    }));
  });

  const selectAll = useEventCallback(() => {
    const ids = elementsNow()
      .filter((element) => isMovable(element) && (element.visible ?? true))
      .map((element) => element.id);
    setSelection(ids);
    return ids.length > 0;
  });

  // --- History ---

  const undo = useEventCallback(() => store.undo());
  const redo = useEventCallback(() => store.redo());

  // --- Adding elements ---

  const addElements = (elements: CanvasElement[]) => {
    if (elements.length === 0) return;
    store.apply({ type: 'addElements', elements });
    setSelection(elements.map((element) => element.id));
    saveSoon();
  };

  const placeText = useEventCallback((x: number, y: number): string => {
    const element = createTextElement(createElementId('text'), 'Text', { x, y }, textDefaults);
    addElements([element]);
    return element.id;
  });

  // Canvas-2D line measurement used to center newly added text. Konva uses
  // the same canvas text metrics, so this tracks the rendered width closely.
  const measureTextLine = (line: string, fontSize: number, fontFamily: string): number => {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return line.length * fontSize * 0.6;
    context.font = `${textDefaults.fontWeight} ${fontSize}px ${fontFamily}`;
    const width = context.measureText(line).width;
    return Number.isFinite(width) ? width : line.length * fontSize * 0.6;
  };

  // Add text centered on the artboard (Stories "Aa", pasted plain text).
  const addCenteredText = useEventCallback((text: string, overrides: Partial<TextDefaults> = {}) => {
    const defaults = { ...textDefaults, ...overrides };
    const block = estimateTextBlockSize(text, defaults.fontSize, defaults.lineHeight, (line) =>
      measureTextLine(line, defaults.fontSize, defaults.fontFamily),
    );
    const position = centeredPlacement(template.width, template.height, block.width, block.height);
    addElements([createTextElement(createElementId('text'), text, position, defaults)]);
  });

  const addShape = useEventCallback((shapeType: ShapeType) => {
    addElements([createShapeElement(createElementId('shape'), shapeType, template, elementsNow())]);
  });

  const placeImage = (src: string, width: number, height: number, position?: Position) => {
    addElements([
      createImageElement(createElementId('image'), src, { width, height }, template, elementsNow(), position),
    ]);
  };

  // Store an image in the user's uploads and return its asset key.
  const uploadUserImage = async (blob: Blob, mimeType: string, name: string, width: number, height: number) => {
    if (!userId) throw new Error('Uploading an image requires a signed-in user.');
    const key = buildUserUploadKey(userId, crypto.randomUUID(), getExtensionFromMime(mimeType));
    // element.src holds the relative asset key (resolved at render time); the
    // user_images row records the same key so it shows up in the Uploads tab.
    const storedKey = await uploadAsset(key, blob, mimeType || 'application/octet-stream');
    await insertUserImageRecord({
      userId,
      name,
      storagePath: storedKey,
      width,
      height,
      fileSize: blob.size,
      assetScope: 'user',
      sourceContext: 'editor',
      assetRole: 'general',
    });
    return storedKey;
  };

  const uploadAndPlace = async (
    read: () => { blob: Blob; mimeType: string; name: string },
    width: number,
    height: number,
    position?: Position,
  ) => {
    if (!userId) {
      onLoginRequired();
      return;
    }
    // The upload can take seconds; say so instead of leaving the canvas silent.
    const dismiss = showEditorToast(t('common:status.uploading'), 'progress');
    try {
      const { blob, mimeType, name } = read();
      placeImage(await uploadUserImage(blob, mimeType, name, width, height), width, height, position);
    } catch (error) {
      console.error('Image upload failed:', error);
      showEditorToast(t('message:error.imageUploadFailed'), 'error');
    } finally {
      dismiss();
    }
  };

  // From the upload button (data URL) or the image library (asset key).
  const addImage = useEventCallback(async (src: string, width: number, height: number) => {
    if (!isDataUrlImage(src)) {
      placeImage(src, width, height);
      return;
    }
    await uploadAndPlace(
      () => {
        const { blob, mimeType } = dataUrlToBlob(src);
        return { blob, mimeType, name: `image-${Date.now()}` };
      },
      width,
      height,
    );
  });

  // From a file dropped on the canvas or pasted from the clipboard.
  const addImageFile = useEventCallback(async (file: File, width: number, height: number, position?: Position) => {
    await uploadAndPlace(() => ({ blob: file, mimeType: file.type, name: file.name || 'image' }), width, height, position);
  });

  // --- Clipboard ---

  const copy = useEventCallback(() => {
    const selected = selectedNow();
    if (selected.length === 0) return false;
    writeElementClipboard(selected);
    return true;
  });

  const removeElements = (ids: string[]) => {
    if (ids.length === 0) return false;
    store.apply({ type: 'deleteElements', ids });
    setSelection(selectedElementIds.filter((id) => !ids.includes(id)));
    saveSoon();
    return true;
  };

  // Locked elements stay: locking is how a template protects its artwork.
  const deleteSelected = useEventCallback(() => removeElements(selectedNow().filter(isMovable).map((el) => el.id)));

  const deleteElement = useEventCallback((id: string) => {
    removeElements([id]);
  });

  const cut = useEventCallback(() => {
    const movable = selectedNow().filter(isMovable);
    if (movable.length === 0) return false;
    writeElementClipboard(movable);
    return removeElements(movable.map((el) => el.id));
  });

  const duplicate = useEventCallback(() => {
    const selected = selectedNow();
    if (selected.length === 0) return false;
    addElements(cloneElements(selected, CASCADE_OFFSET, createElementId));
    return true;
  });

  const pasteElements = () => {
    const payload = readElementClipboard();
    if (!payload || payload.elements.length === 0) return false;
    const counter = pasteCountRef.current;
    const count = counter.token === payload.token ? counter.count + 1 : 1;
    pasteCountRef.current = { token: payload.token, count };
    addElements(cloneElements(payload.elements, CASCADE_OFFSET * count, createElementId));
    return true;
  };

  // Paste the editor's own element copy (context menu), without consulting
  // the system clipboard: reading it outside a paste event asks for permission.
  const pasteCopiedElements = useEventCallback(() => pasteElements());
  const hasCopiedElements = () => (readElementClipboard()?.elements.length ?? 0) > 0;

  const pasteImages = async (files: File[]) => {
    for (const file of files) {
      try {
        const { width, height } = await readImageSize(file);
        await addImageFile(file, width, height);
      } catch (error) {
        console.error('Pasted image could not be added:', error);
        showEditorToast(t('message:error.imageUploadFailed'), 'error');
      }
    }
  };

  // Handles a paste event. Returns false when there was nothing to paste, so
  // the event keeps its default behaviour.
  const paste = useEventCallback((event: ClipboardEvent) => {
    const data = event.clipboardData;
    const imageFiles = Array.from(data?.files ?? []).filter((file) => file.type.startsWith('image/'));
    const source = resolvePasteSource({
      html: data?.getData('text/html') ?? '',
      text: data?.getData('text/plain') ?? '',
      imageFiles,
      internal: readElementClipboard(),
    });

    switch (source.kind) {
      case 'elements':
        return pasteElements();
      case 'images':
        void pasteImages(source.files);
        return true;
      case 'text':
        addCenteredText(source.text);
        return true;
      default:
        return false;
    }
  });

  // --- Moving and ordering ---

  const nudge = useEventCallback((dx: number, dy: number) => {
    const ids = selectedNow().filter(isMovable).map((el) => el.id);
    if (ids.length === 0) return false;
    // Holding an arrow key (or tapping it in quick succession) is one undo
    // step, not one per key repeat.
    const session = nudgeSessionRef.current;
    const now = Date.now();
    if (now - session.lastAt > NUDGE_SESSION_GAP_MS) session.id += 1;
    session.lastAt = now;
    store.apply(
      { type: 'updateElements', ids, updateFn: (el) => ({ x: el.x + dx, y: el.y + dy }) },
      `nudge:${session.id}:${ids.join(',')}`,
    );
    return true;
  });

  const reorder = (type: 'bringToFront' | 'sendToBack' | 'bringForward' | 'sendBackward') => {
    if (selectedElementIds.length === 0) return false;
    store.apply({ type, ids: selectedElementIds });
    return true;
  };
  const bringToFront = useEventCallback(() => reorder('bringToFront'));
  const sendToBack = useEventCallback(() => reorder('sendToBack'));
  const bringForward = useEventCallback(() => reorder('bringForward'));
  const sendBackward = useEventCallback(() => reorder('sendBackward'));

  const reorderElements = useEventCallback((newOrder: CanvasElement[]) => {
    store.apply({ type: 'reorderElements', elements: newOrder });
  });

  // Move each selected element so its bounding box is centered on the
  // artboard along one axis. Uses the rendered bounds, so rotated elements
  // and auto-sized text are centered by what is actually drawn.
  const centerOnArtboard = (axis: 'x' | 'y') => {
    const nodes = canvasRef.current?.getNodesMap();
    const layer = canvasRef.current?.getLayerNode();
    if (!nodes || !layer || selectedElementIds.length === 0) return;

    const offsets = new Map<string, number>();
    selectedNow().filter(isMovable).forEach((element) => {
      const node = nodes.get(element.id);
      if (!node) return;
      const rect = node.getClientRect({ relativeTo: layer, skipShadow: true });
      const offset = axis === 'x'
        ? template.width / 2 - (rect.x + rect.width / 2)
        : template.height / 2 - (rect.y + rect.height / 2);
      offsets.set(element.id, offset);
    });
    if (offsets.size === 0) return;

    store.apply({
      type: 'updateElements',
      ids: [...offsets.keys()],
      updateFn: (el) => (axis === 'x' ? { x: el.x + (offsets.get(el.id) ?? 0) } : { y: el.y + (offsets.get(el.id) ?? 0) }),
    });
  };
  const centerHorizontal = useEventCallback(() => centerOnArtboard('x'));
  const centerVertical = useEventCallback(() => centerOnArtboard('y'));

  // Cover the canvas with the selected image while preserving aspect ratio.
  // Overflow on the longer axis is centered and clipped by the artboard.
  const fitToCanvas = useEventCallback(() => {
    if (selectedElementIds.length !== 1) return;
    const element = elementsNow().find((el) => el.id === selectedElementIds[0]);
    if (!element || element.type !== 'image') return;
    const placement = getFitToCanvasPlacement(template.width, template.height, element.width, element.height);
    if (placement.width <= 0 || placement.height <= 0) return;
    store.apply({ type: 'updateElement', id: element.id, updates: placement });
  });

  // --- Canvas commits ---

  const updateElement = useEventCallback((id: string, updates: Partial<CanvasElement>) => {
    store.apply({ type: 'updateElement', id, updates });
  });

  const updateElements = useEventCallback(
    (ids: string[], updateFn: (element: CanvasElement) => Partial<CanvasElement>) => {
      store.apply({ type: 'updateElements', ids, updateFn });
    },
  );

  // Live preview of a gesture on one element (Stories pinch).
  const previewElement = useEventCallback((id: string, updates: Partial<CanvasElement>) => {
    store.preview({ type: 'updateElement', id, updates });
  });

  const commitPreview = useEventCallback(() => store.commitPreview());

  // Inline text edit finished. Clearing the text removes the element: an
  // empty text has no size and could never be selected again.
  const changeText = useEventCallback((id: string, text: string) => {
    if (text.trim() === '') {
      removeElements([id]);
      return;
    }
    store.apply({ type: 'updateElement', id, updates: { text } });
  });

  // --- Properties of the selection ---

  const applyToSelection = (updateFn: (element: CanvasElement) => Partial<CanvasElement>) => {
    if (selectedElementIds.length === 0) return;
    store.apply({ type: 'updateElements', ids: selectedElementIds, updateFn });
  };

  // Sliders and color pickers preview continuously; the gesture is recorded
  // as one undo step by commitPreview when it ends.
  const previewOnSelection = (updateFn: (element: CanvasElement) => Partial<CanvasElement>) => {
    if (selectedElementIds.length === 0) return;
    store.preview({ type: 'updateElements', ids: selectedElementIds, updateFn });
  };

  const onText = (updates: Partial<CanvasElement>) => (el: CanvasElement) => (el.type === 'text' ? updates : {});
  const onPaintable = (updates: Partial<CanvasElement>) => (el: CanvasElement) =>
    el.type === 'text' || el.type === 'shape' ? updates : {};

  const changeFont = useEventCallback((fontFamily: string) => {
    setTextDefaults((previous) => ({ ...previous, fontFamily }));
    applyToSelection(onText({ fontFamily }));
  });

  const changeFontSize = useEventCallback((fontSize: number) => {
    setTextDefaults((previous) => ({ ...previous, fontSize }));
    previewOnSelection(onText({ fontSize }));
  });

  const changeFontWeight = useEventCallback((fontWeight: number) => {
    setTextDefaults((previous) => ({ ...previous, fontWeight }));
    previewOnSelection(onText({ fontWeight }));
  });

  const changeLetterSpacing = useEventCallback((letterSpacing: number) => {
    setTextDefaults((previous) => ({ ...previous, letterSpacing }));
    previewOnSelection(onText({ letterSpacing }));
  });

  const changeLineHeight = useEventCallback((lineHeight: number) => {
    setTextDefaults((previous) => ({ ...previous, lineHeight }));
    previewOnSelection(onText({ lineHeight }));
  });

  const changeAlign = useEventCallback((align: 'left' | 'center' | 'right') => {
    applyToSelection(onText({ align }));
  });

  const changeFill = useEventCallback((fill: string) => {
    previewOnSelection(onPaintable({ fill }));
    // A single selected text also updates the color the next text starts with.
    const selected = selectedNow();
    if (selected.length === 1 && selected[0].type === 'text') {
      setTextDefaults((previous) => ({ ...previous, fill }));
    }
  });

  const changeFillEnabled = useEventCallback((fillEnabled: boolean) => applyToSelection(onPaintable({ fillEnabled })));
  const changeStroke = useEventCallback((stroke: string) => previewOnSelection(onPaintable({ stroke })));
  const changeStrokeWidth = useEventCallback((strokeWidth: number) => previewOnSelection(onPaintable({ strokeWidth })));
  const changeStrokeEnabled = useEventCallback((strokeEnabled: boolean) => applyToSelection(onPaintable({ strokeEnabled })));
  const changeOpacity = useEventCallback((opacity: number) => previewOnSelection(() => ({ opacity })));
  const changeShadowEnabled = useEventCallback((shadowEnabled: boolean) => applyToSelection(() => ({ shadowEnabled })));
  const changeShadowColor = useEventCallback((shadowColor: string) => previewOnSelection(() => ({ shadowColor })));
  const changeShadowBlur = useEventCallback((shadowBlur: number) => previewOnSelection(() => ({ shadowBlur })));
  const changeShadowOffsetX = useEventCallback((shadowOffsetX: number) => previewOnSelection(() => ({ shadowOffsetX })));
  const changeShadowOffsetY = useEventCallback((shadowOffsetY: number) => previewOnSelection(() => ({ shadowOffsetY })));
  const changeShadowOpacity = useEventCallback((shadowOpacity: number) => previewOnSelection(() => ({ shadowOpacity })));
  const changeImageBlur = useEventCallback((blurRadius: number) =>
    previewOnSelection((el) => (el.type === 'image' ? { blurRadius } : {})),
  );

  // --- Layer flags ---

  const toggleLock = useEventCallback((id: string) => {
    const element = elementsNow().find((el) => el.id === id);
    if (!element) return;
    const locked = !element.locked;
    store.apply({ type: 'updateElement', id, updates: { locked } });
    if (locked) setSelection(selectedElementIds.filter((selectedId) => selectedId !== id));
  });

  // Lock or unlock the whole selection. Locking releases it: a locked element
  // cannot be manipulated on the canvas.
  const setSelectionLocked = useEventCallback((locked: boolean) => {
    if (selectedElementIds.length === 0) return;
    store.apply({ type: 'updateElements', ids: selectedElementIds, updateFn: () => ({ locked }) });
    if (locked) setSelection([]);
  });

  const toggleVisibility = useEventCallback((id: string) => {
    const element = elementsNow().find((el) => el.id === id);
    if (!element) return;
    const visible = !(element.visible ?? true);
    store.apply({ type: 'updateElement', id, updates: { visible } });
    if (!visible) setSelection(selectedElementIds.filter((selectedId) => selectedId !== id));
  });

  // --- Canvas background ---

  const previewCanvasColor = useEventCallback((color: string) => store.setCanvasColor(color, { transient: true }));
  const setCanvasColor = useEventCallback((color: string) => store.setCanvasColor(color));

  // --- Shadow layer ---

  // Generate a black silhouette copy of the selected image as a shadow layer
  const generateShadow = useEventCallback(async () => {
    if (selectedElementIds.length !== 1) return;
    const source = elementsNow().find((el) => el.id === selectedElementIds[0]);
    if (!source || source.type !== 'image') return;
    if (!userId) {
      onLoginRequired();
      return;
    }

    setIsGeneratingShadow(true);
    try {
      // source.src is a relative asset key; resolve it before loading pixels.
      const silhouette = await createSilhouetteBlob(resolveElementSrc(source.src));
      const key = buildUserUploadKey(userId, crypto.randomUUID(), 'png');
      const storedKey = await uploadAsset(key, silhouette, 'image/png');
      await insertUserImageRecord({
        userId,
        name: 'shadow.png',
        storagePath: storedKey,
        width: source.width,
        height: source.height,
        fileSize: silhouette.size,
        assetScope: 'user',
        sourceContext: 'editor',
        assetRole: 'shadow',
      });

      // 45-degree offset (down-right)
      const offset = Math.min(source.width, source.height) * 0.05;
      const shadow: ImageElement = {
        id: createElementId('image'),
        type: 'image',
        x: source.x + offset,
        y: source.y + offset,
        src: storedKey,
        width: source.width,
        height: source.height,
        rotation: source.rotation,
        opacity: 0.3,
        visible: true,
      };

      // Insert the shadow just behind the source element.
      store.apply({ type: 'insertElementsBelow', elements: [shadow], beforeId: source.id });
      setSelection([shadow.id]);
      saveSoon();
    } catch (error) {
      // Surface failures instead of swallowing them silently.
      console.error('Failed to generate shadow:', error);
      showEditorToast(t('message:error.imageGenerationFailed'), 'error');
    } finally {
      setIsGeneratingShadow(false);
    }
  });

  return {
    isGeneratingShadow,
    selectElements,
    selectAll,
    undo,
    redo,
    placeText,
    addCenteredText,
    addShape,
    addImage,
    addImageFile,
    copy,
    cut,
    paste,
    pasteCopiedElements,
    hasCopiedElements,
    duplicate,
    deleteSelected,
    deleteElement,
    nudge,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    reorderElements,
    centerHorizontal,
    centerVertical,
    fitToCanvas,
    updateElement,
    updateElements,
    previewElement,
    commitPreview,
    changeText,
    changeFont,
    changeFontSize,
    changeFontWeight,
    changeLetterSpacing,
    changeLineHeight,
    changeAlign,
    changeFill,
    changeFillEnabled,
    changeStroke,
    changeStrokeWidth,
    changeStrokeEnabled,
    changeOpacity,
    changeShadowEnabled,
    changeShadowColor,
    changeShadowBlur,
    changeShadowOffsetX,
    changeShadowOffsetY,
    changeShadowOpacity,
    changeImageBlur,
    toggleLock,
    setSelectionLocked,
    toggleVisibility,
    previewCanvasColor,
    setCanvasColor,
    generateShadow,
  };
}
