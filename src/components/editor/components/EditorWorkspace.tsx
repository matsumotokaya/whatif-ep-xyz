import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from '@/components/editor/lib/router';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { PropertyPanel, type ElementGeometryUpdate } from './PropertyPanel';
import { BottomBar } from './BottomBar';
import { MobileToolbar } from './MobileToolbar';
import { SaveAsTemplateModal } from './SaveAsTemplateModal';
import { ImageLibraryModal } from './ImageLibraryModal';
import { GuestLimitModal } from './GuestLimitModal';
import { EditorStage } from './EditorStage';
import { EditorToasts } from './EditorToasts';
import { EditorContextMenu, type ContextMenuItem } from './EditorContextMenu';
import { LazyCanvas } from './LazyCanvas';
import { ImageLoadFeedback } from './canvas/ImageLoadFeedback';
import { LoadingOverlay } from './canvas/LoadingOverlay';
import type { CanvasProps, CanvasRef } from './Canvas';
import { StoriesShell } from '../stories/StoriesShell';
import { useStoriesMode } from '../stories/useStoriesMode';
import { useStoriesEditing } from '../stories/useStoriesEditing';
import { StoriesTextEditor } from '../stories/StoriesTextEditor';
import { StoriesBackgroundSheet } from '../stories/StoriesBackgroundSheet';
import { StoriesEffectsSheet } from '../stories/StoriesEffectsSheet';
import { useBatchSaveBanner, useUpdateBanner, useUpdateBannerName } from '../hooks/useBanners';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { useEditorPersistence } from '../hooks/useEditorPersistence';
import { useEditorActions } from '../hooks/useEditorActions';
import { useEditorShortcuts } from '../hooks/useEditorShortcuts';
import { useEventCallback } from '../hooks/useEventCallback';
import { useAuth } from '../contexts/AuthContext';
import type { Banner, CanvasElement, Template } from '../types/template';
import { BLEED } from '../utils/canvasGeometry';
import { DocumentStore, canRedoDocument, canUndoDocument } from '../utils/documentStore';
import { ViewportStore } from '../utils/viewportStore';
import { buildGuestInitialDocument, buildMemberInitialDocument } from '../utils/editorBootstrap';
import { clearEditorRecovery, readEditorRecovery } from '../utils/editorRecovery';
import { INITIAL_TEXT_DEFAULTS, createElementId, type TextDefaults } from '../utils/elementFactory';
import type { EditorShortcut } from '../utils/editorShortcuts';
import { showEditorToast } from '../utils/editorToasts';
import { exportImageFromDataUrl } from '../utils/exportImage';
import { templateStorage } from '../utils/templateStorage';
import { dataUrlToBlob } from '../utils/storage';
import { uploadAsset } from '../utils/r2Upload';
import { buildTemplateThumbKey, createAssetRevision } from '@/lib/asset';

// A guest design lives only in this browser (localStorage).
export interface GuestDocumentSource {
  kind: 'guest';
  name: string;
  template: Template;
  elements: CanvasElement[];
  canvasColor: string;
  createdAt: string;
}

// A signed-in user's saved design. `banner` is the latest server row; the
// document itself is read from it once, when the workspace mounts.
export interface MemberDocumentSource {
  kind: 'member';
  banner: Banner;
}

export type EditorDocumentSource = GuestDocumentSource | MemberDocumentSource;

interface EditorWorkspaceProps {
  source: EditorDocumentSource;
  // Where "save & back" leads.
  returnTo: string;
}

// A data URL shorter than this is an empty or failed canvas read.
const MIN_EXPORT_DATA_URL_LENGTH = 100;

// The editor for one open document. Mounted once per document (the parent
// keys it by document), so every piece of state here starts fresh with it and
// nothing has to be reset when another design is opened.
export function EditorWorkspace({ source, returnTo }: EditorWorkspaceProps) {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { t } = useTranslation(['common', 'message', 'banner', 'auth', 'editor']);
  // Stories mode: the phone-dedicated shell (or forced via ?stories=1).
  const storiesMode = useStoriesMode();

  const isGuest = source.kind === 'guest';
  const banner = source.kind === 'member' ? source.banner : null;
  const bannerId = banner?.id ?? '';
  const userId = user?.id ?? null;

  const batchSave = useBatchSaveBanner(bannerId);
  const updateBanner = useUpdateBanner(bannerId);
  const updateName = useUpdateBannerName(bannerId);

  // --- Document ---

  const [initial] = useState(() =>
    source.kind === 'member'
      ? buildMemberInitialDocument(
          source.banner,
          userId ? readEditorRecovery(userId, source.banner.id) : null,
          () => createElementId('text'),
        )
      : buildGuestInitialDocument(source.elements, source.canvasColor),
  );
  const [store] = useState(() => new DocumentStore(initial));
  const doc = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { elements, canvasColor } = doc;

  useEffect(() => {
    if (initial.discardRecovery && userId && bannerId) clearEditorRecovery(userId, bannerId);
  }, [initial, userId, bannerId]);

  // A guest can resize the artboard; a saved design's size lives on its row.
  const [guestTemplate, setGuestTemplate] = useState<Template | null>(
    source.kind === 'guest' ? source.template : null,
  );
  const template = (banner?.template ?? guestTemplate) as Template;
  const name = banner ? banner.name : (source.kind === 'guest' && source.name) || 'Guest Banner';

  // --- Selection ---

  const [selection, setSelection] = useState<string[]>([]);
  // Undo, redo or a delete can remove a selected element; never hand out ids
  // that are no longer in the document.
  const selectedElementIds = useMemo(() => {
    const existing = new Set(elements.map((element) => element.id));
    const valid = selection.filter((id) => existing.has(id));
    return valid.length === selection.length ? selection : valid;
  }, [selection, elements]);
  const selectedElements = useMemo(
    () => elements.filter((element) => selectedElementIds.includes(element.id)),
    [elements, selectedElementIds],
  );
  const singleSelected = selectedElements.length === 1 ? selectedElements[0] : null;

  // Sticky text settings: seeded from the last text the user touched.
  const [textDefaults, setTextDefaults] = useState<TextDefaults>(INITIAL_TEXT_DEFAULTS);

  // --- Editor modes ---

  const [textPlacementMode, setTextPlacementMode] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [isCanvasEditing, setIsCanvasEditing] = useState(false);
  const [isMobileToolDrawerOpen, setIsMobileToolDrawerOpen] = useState(false);
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<CanvasRef>(null);
  const isTransformingRef = useRef(false);
  const handleTransformingChange = useCallback((transforming: boolean) => {
    isTransformingRef.current = transforming;
  }, []);

  // --- View (Studio) ---

  const [viewportStore] = useState(() => new ViewportStore({ width: template.width, height: template.height }));
  useEffect(() => {
    viewportStore.setArtboard({ width: template.width, height: template.height });
  }, [viewportStore, template.width, template.height]);

  // --- Entrance animation ---

  const [imageLoadStatus, setImageLoadStatus] = useState<Map<string, 'loaded' | 'error'>>(new Map());
  const [totalImageCount] = useState(() => initial.elements.filter((element) => element.type === 'image').length);
  const [entranceEnabled, setEntranceEnabled] = useState(true);
  const handleImageLoad = useCallback((id: string, status: 'loaded' | 'error') => {
    setImageLoadStatus((previous) => {
      if (previous.get(id) === status) return previous;
      const next = new Map(previous);
      next.set(id, status);
      return next;
    });
  }, []);

  const { phase: animationPhase, finishForExport } = useEntranceAnimation({
    elements,
    canvasRef,
    imageLoadStatus,
    totalImageCount,
    enabled: entranceEnabled,
  });

  // The entrance plays once, when the document opens.
  useEffect(() => {
    if (animationPhase === 'complete') setEntranceEnabled(false);
  }, [animationPhase]);
  // Present once the entrance has finished and the canvas accepts input, so
  // automation (and the e2e specs) can tell when the editor is usable.
  const editorReady = entranceEnabled ? undefined : '';

  // --- Persistence ---

  const guestCreatedAt = source.kind === 'guest' ? source.createdAt : '';
  const persistence = useEditorPersistence({
    store,
    canvasRef,
    target: isGuest
      ? { mode: 'guest', getSnapshotMeta: () => ({ name, template, createdAt: guestCreatedAt }) }
      : {
          mode: 'member',
          bannerId,
          userId: userId ?? undefined,
          getBanner: () => banner,
          save: batchSave.mutateAsync,
        },
    initiallyDirty: initial.needsSave,
    isCanvasBusy: () => isTransformingRef.current || (canvasRef.current?.isDragging() ?? false),
    saveFailedMessage: t('message:error.saveFailed'),
  });
  const { saveStatus, flush, saveSoon } = persistence;

  // --- Actions ---

  const actions = useEditorActions({
    store,
    canvasRef,
    template,
    selectedElementIds,
    setSelection,
    textDefaults,
    setTextDefaults,
    userId,
    saveSoon,
    onLoginRequired: () => setShowLoginPrompt(true),
    t,
  });

  const stories = useStoriesEditing({
    store,
    textDefaults,
    setTextDefaults,
    selectElements: actions.selectElements,
    addCenteredText: actions.addCenteredText,
    deleteElement: actions.deleteElement,
    saveSoon,
  });

  const handleSave = useEventCallback(() => {
    void flush(true).catch(() => {
      // The failure is shown by the save status indicator.
    });
  });

  useEditorShortcuts({
    onShortcut: (shortcut: EditorShortcut) => {
      switch (shortcut.type) {
        case 'undo':
          actions.undo();
          return true;
        case 'redo':
          actions.redo();
          return true;
        case 'save':
          handleSave();
          return true;
        case 'copy':
          return actions.copy();
        case 'cut':
          return actions.cut();
        case 'duplicate':
          return actions.duplicate();
        case 'delete':
          return actions.deleteSelected();
        case 'selectAll':
          // Multi-selection is not part of the Stories shell.
          return storiesMode ? false : actions.selectAll();
        case 'escape':
          if (textPlacementMode) {
            setTextPlacementMode(false);
            return true;
          }
          if (selectedElementIds.length > 0) {
            actions.selectElements([]);
            return true;
          }
          return false;
        case 'nudge':
          return actions.nudge(shortcut.dx, shortcut.dy);
        case 'bringForward':
          return actions.bringForward();
        case 'sendBackward':
          return actions.sendBackward();
        case 'bringToFront':
          return actions.bringToFront();
        case 'sendToBack':
          return actions.sendToBack();
        case 'zoomIn':
          viewportStore.zoomStep(1);
          return true;
        case 'zoomOut':
          viewportStore.zoomStep(-1);
          return true;
        case 'zoomFit':
          viewportStore.fit();
          return true;
        case 'zoomActual':
          viewportStore.zoomTo(1);
          return true;
        default: {
          const _exhaustive: never = shortcut;
          return _exhaustive;
        }
      }
    },
    onPaste: actions.paste,
  });

  // --- Export, navigation, document settings ---

  const handleExport = useEventCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      await canvas.whenReadyForExport();
      const dataURL = canvas.exportImage();
      if (!dataURL || dataURL.length < MIN_EXPORT_DATA_URL_LENGTH) {
        showEditorToast(t('message:error.imageGenerationFailed'), 'error');
        return;
      }

      const exportResult = await exportImageFromDataUrl(dataURL, `${name}.png`);
      if (exportResult.isIOS && exportResult.method !== 'share-files') {
        showEditorToast(t('message:info.saveImageGuide'));
      }
      if (exportResult.inAppBrowser) {
        showEditorToast(t('message:info.inAppBrowserGuide'));
      }
    } catch (error) {
      // The user closed the share sheet.
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Error exporting image:', error);
      showEditorToast(t('message:error.exportFailed'), 'error');
    }
  });

  const handleInternalNavigation = useEventCallback(async (target: string) => {
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      await flush(true);
      navigate(target);
    } catch (error) {
      console.error('[editor] Failed to save before navigating:', error);
      if (window.confirm(t('banner:saveFailedConfirm'))) {
        navigate(target);
      }
    } finally {
      setIsNavigating(false);
    }
  });

  const handleBackToManager = useEventCallback(() => handleInternalNavigation(returnTo));

  const handleBannerNameChange = useEventCallback(async (newName: string) => {
    if (isGuest) return;
    await updateName.mutateAsync(newName);
  });

  const handleCanvasSizeChange = useEventCallback(async (width: number, height: number) => {
    if (isGuest) {
      setGuestTemplate({ ...template, width, height });
      // The artboard size is part of the stored guest design.
      persistence.markSettingsDirty();
      return;
    }
    try {
      await updateBanner.mutateAsync({ template: { ...template, width, height } });
    } catch (error) {
      console.error('[editor] Failed to change the canvas size:', error);
      showEditorToast(t('message:error.saveFailed'), 'error');
    }
  });

  const handleSaveAsTemplate = useEventCallback(() => {
    // Only admins can register a template.
    if (profile?.role !== 'admin') return;
    setShowSaveAsTemplateModal(true);
  });

  const handleTemplateModalSave = useEventCallback(
    async ({ planType, displayOrder }: { planType: 'free' | 'premium'; displayOrder: number }) => {
      const canvas = canvasRef.current;
      await canvas?.whenReadyForExport();
      const thumbnailDataUrl = canvas?.exportThumbnail();
      if (!thumbnailDataUrl) {
        throw new Error('Failed to generate the template thumbnail.');
      }

      // Create the template first to obtain its id, then upload the thumbnail
      // to the template's OWN deterministic R2 key and record that key.
      const state = store.getState();
      const templateId = await templateStorage.createTemplate({
        name,
        elements: state.elements,
        canvasColor: state.canvasColor,
        planType,
        displayOrder,
        width: template.width,
        height: template.height,
      });

      if (templateId) {
        const { blob, mimeType } = dataUrlToBlob(thumbnailDataUrl);
        const key = await uploadAsset(buildTemplateThumbKey(templateId, createAssetRevision()), blob, mimeType);
        await templateStorage.setTemplateThumbnailKey(templateId, key);
      }
      // The modal closes itself and reports success or failure.
    },
  );

  const redirectToLogin = useEventCallback(() => {
    const redirectPath = bannerId ? `/edit/${bannerId}` : '/edit';
    navigate(`/auth/login?next=${encodeURIComponent(redirectPath)}`);
  });

  const toggleTextPlacement = useEventCallback(() => setTextPlacementMode((previous) => !previous));
  const clearSelection = useEventCallback(() => actions.selectElements([]));

  // Placing the text ends placement mode; the canvas opens it for editing.
  const handlePlaceText = useEventCallback((x: number, y: number) => {
    setTextPlacementMode(false);
    return actions.placeText(x, y);
  });

  const handleCanvasContextMenu = useEventCallback((position: { clientX: number; clientY: number }) => {
    setContextMenu({ x: position.clientX, y: position.clientY });
  });
  const closeContextMenu = useEventCallback(() => setContextMenu(null));

  // Right-click menu: actions on the selection, then paste / select all.
  const buildContextMenu = (): ContextMenuItem[][] => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const hint = (key: string, shift = false) => (isMac ? `${shift ? '⇧' : ''}⌘${key}` : `Ctrl+${shift ? 'Shift+' : ''}${key}`);
    const hasSelection = selectedElements.length > 0;
    const allLocked = hasSelection && selectedElements.every((element) => element.locked);

    const onSelection: ContextMenuItem[] = hasSelection
      ? [
          { key: 'copy', label: t('editor:clipboard.copy'), hint: hint('C'), onSelect: actions.copy },
          { key: 'cut', label: t('editor:clipboard.cut'), hint: hint('X'), disabled: allLocked, onSelect: actions.cut },
          { key: 'duplicate', label: t('common:button.duplicate'), hint: hint('D'), onSelect: actions.duplicate },
          { key: 'delete', label: t('common:button.delete'), hint: isMac ? '⌫' : 'Del', disabled: allLocked, onSelect: actions.deleteSelected },
        ]
      : [];
    const order: ContextMenuItem[] = hasSelection
      ? [
          { key: 'forward', label: t('editor:properties.moveUp'), hint: hint(']'), onSelect: actions.bringForward },
          { key: 'backward', label: t('editor:properties.moveDown'), hint: hint('['), onSelect: actions.sendBackward },
          { key: 'front', label: t('editor:properties.bringToFront'), hint: hint(']', true), onSelect: actions.bringToFront },
          { key: 'back', label: t('editor:properties.sendToBack'), hint: hint('[', true), onSelect: actions.sendToBack },
        ]
      : [];
    const lock: ContextMenuItem[] = hasSelection
      ? [
          {
            key: 'lock',
            label: allLocked ? t('editor:unlock') : t('editor:lock'),
            onSelect: () => actions.setSelectionLocked(!allLocked),
          },
        ]
      : [];
    const general: ContextMenuItem[] = [
      {
        key: 'paste',
        label: t('editor:clipboard.paste'),
        hint: hint('V'),
        disabled: !actions.hasCopiedElements(),
        onSelect: actions.pasteCopiedElements,
      },
      { key: 'selectAll', label: t('editor:selectAll'), hint: hint('A'), onSelect: actions.selectAll },
    ];
    return [onSelection, order, lock, general];
  };

  // Props every canvas mount shares. The two shells render exclusively, so
  // the Konva stage is only ever mounted once.
  const canvasProps: Omit<CanvasProps, 'scale' | 'viewport' | 'interactionMode'> = {
    template,
    elements,
    canvasColor,
    onTextChange: actions.changeText,
    selectedElementIds,
    onSelectElement: actions.selectElements,
    onElementUpdate: actions.updateElement,
    onElementsUpdate: actions.updateElements,
    onImageDrop: actions.addImageFile,
    onImageLoad: handleImageLoad,
    entranceAnimationPhase: animationPhase,
    onBeforeExport: finishForExport,
    textPlacementMode,
    onPlaceText: handlePlaceText,
    onEditingChange: setIsCanvasEditing,
    onTransformingChange: handleTransformingChange,
  };

  const handleGeometryChange = useEventCallback((updates: ElementGeometryUpdate) => {
    if (singleSelected) actions.updateElement(singleSelected.id, updates);
  });

  const propertyPanelProps = {
    selectedElement: singleSelected,
    onColorChange: actions.changeFill,
    onInteractionEnd: actions.commitPreview,
    onFontChange: actions.changeFont,
    onSizeChange: actions.changeFontSize,
    onWeightChange: actions.changeFontWeight,
    onLetterSpacingChange: actions.changeLetterSpacing,
    onLineHeightChange: actions.changeLineHeight,
    onAlignChange: actions.changeAlign,
    onOpacityChange: actions.changeOpacity,
    onBringToFront: actions.bringToFront,
    onSendToBack: actions.sendToBack,
    onFillEnabledChange: actions.changeFillEnabled,
    onStrokeChange: actions.changeStroke,
    onStrokeWidthChange: actions.changeStrokeWidth,
    onStrokeEnabledChange: actions.changeStrokeEnabled,
    onShadowEnabledChange: actions.changeShadowEnabled,
    onShadowColorChange: actions.changeShadowColor,
    onShadowBlurChange: actions.changeShadowBlur,
    onShadowOffsetXChange: actions.changeShadowOffsetX,
    onShadowOffsetYChange: actions.changeShadowOffsetY,
    onShadowOpacityChange: actions.changeShadowOpacity,
    onImageBlurChange: actions.changeImageBlur,
    onGenerateShadow: actions.generateShadow,
    isGeneratingShadow: actions.isGeneratingShadow,
    onFitToCanvas: actions.fitToCanvas,
    selectedCount: selectedElementIds.length,
    selectedElements,
    onCenterHorizontal: actions.centerHorizontal,
    onCenterVertical: actions.centerVertical,
    onGeometryChange: handleGeometryChange,
  };

  const sharedOverlays = (
    <>
      {/* Uploading needs an account: offer the login instead of failing. */}
      <GuestLimitModal
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        onConfirm={redirectToLogin}
        title={t('banner:guestNoticeTitle')}
        message={t('message:error.imageLoginRequired')}
        cancelLabel={t('common:button.cancel')}
        confirmLabel={t('auth:login')}
      />

      <EditorToasts />

      {/* Loading overlay when navigating */}
      {isNavigating && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4 shadow-2xl">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-800">{t('thumbnail.generating')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('thumbnail.pleaseWait')}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (storiesMode) {
    // Effects target a single unlocked element; locked elements can't be
    // selected in Stories mode, but the lock guard keeps it explicit.
    const canApplyEffects = !!singleSelected && !singleSelected.locked;

    const renderStoriesCanvas = (fitScale: number) => (
      <div className="relative">
        <Suspense fallback={<div className="h-[320px] w-[320px] rounded-2xl border border-white/10 bg-[#202020]" />}>
          <LazyCanvas
            ref={canvasRef}
            {...canvasProps}
            scale={fitScale}
            interactionMode="stories"
            onElementTransientUpdate={actions.previewElement}
            onInteractionCommit={actions.commitPreview}
            onStoriesDragStateChange={stories.setDragState}
            onStoriesDeleteElement={actions.deleteElement}
            storiesTrashRef={stories.trashRef}
            onStoriesTextEdit={stories.requestTextEdit}
            storiesTextEditActive={stories.textSession !== null}
          />
        </Suspense>
        <ImageLoadFeedback
          elements={elements}
          scale={fitScale}
          width={template.width}
          height={template.height}
          originX={BLEED * fitScale}
          originY={BLEED * fitScale}
        />
        {(animationPhase === 'loading' || animationPhase === 'animating') && (
          <LoadingOverlay
            elements={elements}
            template={template}
            scale={fitScale}
            phase={animationPhase}
            canvasColor={canvasColor}
            originX={BLEED * fitScale}
            originY={BLEED * fitScale}
          />
        )}
      </div>
    );

    return (
      <div className="flex h-dvh flex-col bg-[#1e1e1e]" data-editor-ready={editorReady}>
        <StoriesShell
          canvasWidth={template.width}
          canvasHeight={template.height}
          renderCanvas={renderStoriesCanvas}
          onClose={handleBackToManager}
          onUndo={actions.undo}
          canUndo={canUndoDocument(doc)}
          saveStatus={saveStatus}
          hasSelection={selectedElementIds.length > 0}
          onDelete={actions.deleteSelected}
          onBringToFront={actions.bringToFront}
          onSendToBack={actions.sendToBack}
          onClearSelection={clearSelection}
          isDraggingElement={stories.dragState.dragging}
          isOverTrash={stories.dragState.overTrash}
          trashRef={stories.trashRef}
          onAddText={stories.startNewText}
          isTextEditing={stories.textSession !== null}
          onOpenStamps={() => stories.setSheet('stamps')}
          onOpenBackground={() => stories.setSheet('background')}
          onOpenEffects={() => stories.setSheet('effects')}
          canApplyEffects={canApplyEffects}
        />

        {/* Stories image library (E3): reuses the existing ImageLibraryModal.
            Selecting an image runs the same addImage path as desktop. The
            modal calls onClose after a selection, which closes the sheet. */}
        <ImageLibraryModal
          isOpen={stories.sheet === 'stamps'}
          onClose={() => stories.setSheet(null)}
          onSelectImage={actions.addImage}
        />

        {/* Stories background color (E3): presets only. */}
        {stories.sheet === 'background' && (
          <StoriesBackgroundSheet
            color={canvasColor}
            onColorChange={actions.setCanvasColor}
            onClose={() => stories.setSheet(null)}
          />
        )}

        {/* Stories effects (E3): opacity / blur / shadow on the selected
            element via the same handlers as the desktop PropertyPanel. Closes
            itself if the selection changes so it never targets a stale one. */}
        {stories.sheet === 'effects' && singleSelected ? (
          <StoriesEffectsSheet
            element={singleSelected}
            onOpacityChange={actions.changeOpacity}
            onImageBlurChange={actions.changeImageBlur}
            onShadowEnabledChange={actions.changeShadowEnabled}
            onShadowColorChange={actions.changeShadowColor}
            onShadowBlurChange={actions.changeShadowBlur}
            onShadowOffsetXChange={actions.changeShadowOffsetX}
            onShadowOffsetYChange={actions.changeShadowOffsetY}
            onShadowOpacityChange={actions.changeShadowOpacity}
            onInteractionEnd={actions.commitPreview}
            onClose={() => stories.setSheet(null)}
          />
        ) : null}

        {/* Fullscreen text editor overlay (E2-c). Keyed by session identity
            so switching sessions always remounts with fresh initial state. */}
        {stories.textSession && (
          <StoriesTextEditor
            key={stories.textSession.mode === 'edit' ? stories.textSession.elementId : 'new'}
            initial={stories.textInitialValue()}
            onDone={stories.finishText}
            onCancel={stories.cancelText}
          />
        )}

        {sharedOverlays}
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#1e1e1e]" data-editor-ready={editorReady}>
      <Header
        onBackToManager={handleBackToManager}
        onInternalNavigate={handleInternalNavigation}
        bannerName={name}
        bannerId={isGuest ? undefined : bannerId}
        onBannerNameChange={isGuest ? undefined : handleBannerNameChange}
        isAdmin={profile?.role === 'admin'}
        onSaveAsTemplate={handleSaveAsTemplate}
      />

      {/* Editor layout: single canvas mount. Only the surrounding chrome
          (sidebar, toolbars, panels) is swapped responsively via CSS so that
          two Konva Stages never compete for the same canvasRef. */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <Sidebar
            canvasColor={canvasColor}
            canvasWidth={template.width}
            canvasHeight={template.height}
            onSelectColor={actions.previewCanvasColor}
            onColorInteractionEnd={actions.commitPreview}
            onCanvasSizeChange={handleCanvasSizeChange}
            onAddText={toggleTextPlacement}
            onAddShape={actions.addShape}
            onAddImage={actions.addImage}
            elements={elements}
            selectedElementIds={selectedElementIds}
            onSelectElement={actions.selectElements}
            onReorderElements={actions.reorderElements}
            onToggleLock={actions.toggleLock}
            onToggleVisibility={actions.toggleVisibility}
            textPlacementMode={textPlacementMode}
            panMode={panMode}
            onPanModeChange={setPanMode}
          />
        </div>

        {/* Mobile floating toolbar: Select / Pan / Undo */}
        <div className="md:hidden absolute top-3 right-3 z-40 flex gap-2">
          <button
            onClick={() => { setPanMode(false); setTextPlacementMode(false); }}
            className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg active:scale-95 transition-all ${!panMode && !textPlacementMode ? 'bg-white/90 text-gray-900' : 'bg-black/50 text-white'}`}
            aria-label="Select"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_selector_tool</span>
          </button>
          <button
            onClick={() => setPanMode(!panMode)}
            className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg active:scale-95 transition-all ${panMode ? 'bg-white/90 text-gray-900' : 'bg-black/50 text-white'}`}
            aria-label="Pan"
          >
            <span className="material-symbols-outlined text-[20px]">pan_tool</span>
          </button>
          <button
            onClick={actions.undo}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-lg active:scale-95 transition-transform text-white"
            aria-label="Undo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H7" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6L3 10l4 4" />
            </svg>
          </button>
        </div>

        <EditorStage
          {...canvasProps}
          onContextMenu={handleCanvasContextMenu}
          viewportStore={viewportStore}
          canvasRef={canvasRef}
          panMode={panMode}
          isTransformingRef={isTransformingRef}
        />

        {/* Desktop property panel */}
        <div className="hidden md:flex">
          <PropertyPanel {...propertyPanelProps} />
        </div>

        {/* Mobile Toolbar - Floating buttons + Drawer */}
        <div className="md:hidden">
          <MobileToolbar
            canvasColor={canvasColor}
            onSelectColor={actions.previewCanvasColor}
            onColorInteractionEnd={actions.commitPreview}
            onAddText={toggleTextPlacement}
            onAddShape={actions.addShape}
            onAddImage={actions.addImage}
            elements={elements}
            selectedElementIds={selectedElementIds}
            onSelectElement={actions.selectElements}
            onReorderElements={actions.reorderElements}
            onToggleLock={actions.toggleLock}
            onToggleVisibility={actions.toggleVisibility}
            textPlacementMode={textPlacementMode}
            panMode={panMode}
            onPanModeChange={setPanMode}
            onDrawerOpenChange={setIsMobileToolDrawerOpen}
          />
        </div>

        {/* Mobile PropertyPanel - Hidden during inline text editing */}
        {!isCanvasEditing && !isMobileToolDrawerOpen && (
          <div className="md:hidden">
            <PropertyPanel
              {...propertyPanelProps}
              isMobile={true}
              onClose={clearSelection}
              onDelete={actions.deleteSelected}
            />
          </div>
        )}
      </div>

      <BottomBar
        viewportStore={viewportStore}
        onExport={handleExport}
        onUndo={actions.undo}
        onRedo={actions.redo}
        canUndo={canUndoDocument(doc)}
        canRedo={canRedoDocument(doc)}
        saveStatus={saveStatus}
        onRetry={handleSave}
      />

      {contextMenu && (
        <EditorContextMenu x={contextMenu.x} y={contextMenu.y} groups={buildContextMenu()} onClose={closeContextMenu} />
      )}

      <SaveAsTemplateModal
        isOpen={showSaveAsTemplateModal}
        onClose={() => setShowSaveAsTemplateModal(false)}
        onSave={handleTemplateModalSave}
        defaultName={name}
      />

      {sharedOverlays}
    </div>
  );
}
