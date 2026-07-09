import { lazy, Suspense, useState, useRef, useEffect, useCallback, type RefObject } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from '@/components/editor/lib/router';
import { useTranslation } from 'react-i18next';
import debounce from 'lodash.debounce';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { PropertyPanel } from '../components/PropertyPanel';
import { BottomBar } from '../components/BottomBar';
import { MobileToolbar } from '../components/MobileToolbar';
import { UpgradeModal } from '../components/UpgradeModal';
import { DesktopRecommendedModal } from '../components/DesktopRecommendedModal';
import { SaveAsTemplateModal } from '../components/SaveAsTemplateModal';
import { GuestEditorNoticeModal } from '../components/GuestEditorNoticeModal';
import { useBanner, useBatchSaveBanner, useUpdateBanner, useUpdateBannerName } from '../hooks/useBanners';
import type { Banner, Template, CanvasElement, TextElement, ShapeElement, ImageElement } from '../types/template';
import { useHistory } from '../hooks/useHistory';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useZoomControl } from '../hooks/useZoomControl';
import { useElementOperations } from '../hooks/useElementOperations';
import { useAuth } from '../contexts/AuthContext';
import { GUEST_STORAGE_KEY } from '../utils/guestDesign';
import { useOpenTemplate } from '../hooks/useOpenTemplate';
import { isDataUrlImage, dataUrlToBlob, getExtensionFromMime } from '../utils/storage';
import { uploadAsset } from '../utils/r2Upload';
import { buildUserUploadKey, buildTemplateThumbKey, createAssetRevision, resolveElementSrc } from '@/lib/asset';
import { templateStorage } from '../utils/templateStorage';
import { exportImageFromDataUrl } from '../utils/exportImage';
import { createSilhouetteBlob } from '../utils/imageShadow';
import { insertUserImageRecord } from '../utils/libraryAssets';
import { getFitToCanvasPlacement } from '../utils/canvasPlacement';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { LoadingOverlay } from '../components/canvas/LoadingOverlay';
import type { CanvasRef } from '../components/Canvas';
import { SaveQueue } from '../utils/saveQueue';

interface SaveRequest {
  generateThumbnail: boolean;
}

const EditorCanvas = lazy(() => import('../components/Canvas').then((module) => ({ default: module.Canvas })));

type BannerEditorLocationState = {
  returnTo?: string;
};

export const BannerEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile, user, loading: authLoading } = useAuth();
  const { t } = useTranslation(['common', 'message', 'banner']);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [isCanvasEditing, setIsCanvasEditing] = useState(false);
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  // Guest-only editor notice (download is fine, saving needs login). Shown once
  // per browser session so it does not nag on every re-entry within a session.
  const [showGuestNotice, setShowGuestNotice] = useState(false);
  const isGuest = !id;
  const guestStorageKey = GUEST_STORAGE_KEY;
  const locationState = location.state as BannerEditorLocationState | null;
  // "Back to list" target. Guests also return to the design list (/mydesign
  // renders their single localStorage design) so they can see their work was
  // saved, instead of the Gallery top.
  const editorReturnTo = locationState?.returnTo || '/mydesign';

  // Show the guest editor notice once the auth state has settled and only for
  // actual logged-out visitors (not a logged-in user momentarily on /banner).
  const GUEST_NOTICE_ACK_KEY = 'whatif_guest_editor_notice_ack';
  useEffect(() => {
    if (authLoading || user) return;
    if (sessionStorage.getItem(GUEST_NOTICE_ACK_KEY)) return;
    setShowGuestNotice(true);
  }, [authLoading, user]);

  const handleGuestNoticeConfirm = () => {
    try {
      sessionStorage.setItem(GUEST_NOTICE_ACK_KEY, '1');
    } catch {
      // sessionStorage may be unavailable (private mode); just dismiss.
    }
    setShowGuestNotice(false);
  };

  const [guestTemplate, setGuestTemplate] = useState<Template | null>(null);
  const [guestName, setGuestName] = useState<string>('');
  const [guestUpdatedAt, setGuestUpdatedAt] = useState<string>(new Date().toISOString());

  // React Query hooks
  const { data: bannerData, isLoading } = useBanner(id);
  const batchSave = useBatchSaveBanner(id || '');
  const updateBanner = useUpdateBanner(id || '');
  const updateName = useUpdateBannerName(id || '');

  // Local state for editing (not persisted immediately)
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [canvasColor, setCanvasColor] = useState<string>('#FFFFFF');
  const [selectedFont, setSelectedFont] = useState<string>('Arial');
  const [selectedSize, setSelectedSize] = useState<number>(80);
  const [selectedWeight, setSelectedWeight] = useState<number>(400);
  const [selectedLetterSpacing, setSelectedLetterSpacing] = useState<number>(0);
  const [selectedLineHeight, setSelectedLineHeight] = useState<number>(1);
  const [selectedTextColor, setSelectedTextColor] = useState<string>('#000000');
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [copiedElements, setCopiedElements] = useState<CanvasElement[]>([]);
  const [textPlacementMode, setTextPlacementMode] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [isGeneratingShadow, setIsGeneratingShadow] = useState(false);
  const isTransformingRef = useRef(false);
  const handleTransformingChange = useCallback((transforming: boolean) => {
    setIsTransforming(transforming);
    isTransformingRef.current = transforming;
    // Stop any ongoing pan when transform starts
    if (transforming) setIsPanning(false);
  }, []);
  const canvasRef = useRef<CanvasRef>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const guestCreatedAtRef = useRef<string>(new Date().toISOString());
  const guestMountedRef = useRef(false);
  const prevGuestElementsRef = useRef<CanvasElement[] | null>(null);
  const prevGuestCanvasColorRef = useRef<string>('');

  // Track current banner ID to detect banner switches
  const [currentBannerId, setCurrentBannerId] = useState<string | null>(null);

  // Entrance animation state
  const [imageLoadStatus, setImageLoadStatus] = useState<Map<string, 'loaded' | 'error'>>(new Map());
  const [totalImageCount, setTotalImageCount] = useState(0);
  const isInitialLoadRef = useRef(false);

  // Track previous values to detect actual changes
  const prevElementsRef = useRef<CanvasElement[] | null>(null);
  const prevCanvasColorRef = useRef<string>('');
  const isMountedRef = useRef(false);
  const previewDirtyRef = useRef(false);

  // Entrance animation callbacks
  const handleImageLoad = useCallback((id: string, status: 'loaded' | 'error') => {
    setImageLoadStatus(prev => {
      const next = new Map(prev);
      next.set(id, status);
      return next;
    });
  }, []);

  const { phase: animationPhase } = useEntranceAnimation({
    elements,
    canvasRef: canvasRef as RefObject<CanvasRef | null>,
    imageLoadStatus,
    totalImageCount,
    enabled: isInitialLoadRef.current,
  });

  // Mark initial load as done when animation completes
  useEffect(() => {
    if (animationPhase === 'complete') {
      isInitialLoadRef.current = false;
    }
  }, [animationPhase]);

  // Show desktop recommended modal on mobile
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const dismissed = localStorage.getItem('imagine_desktop_modal_dismissed');
    if (isMobile && !dismissed) {
      setShowDesktopModal(true);
    }
  }, []);

  // Custom hooks
  const { resetHistory, saveToHistory, undo, redo } = useHistory();
  const getInitialZoom = () => {
    const isMobile = window.innerWidth < 768;
    return isMobile ? 30 : 40;
  };
  const { zoom, setZoom, panOffset, setPanOffset, resetView } = useZoomControl({
    initialZoom: getInitialZoom(),
    containerRef: mainRef,
  });
  const safeZoom = Number.isFinite(zoom) ? zoom : getInitialZoom();
  const handleZoomChange = useCallback((nextZoom: number) => {
    if (!Number.isFinite(nextZoom)) return;
    setZoom(Math.max(25, Math.min(200, Math.round(nextZoom))));
  }, [setZoom]);

  // Pan (grab & drag) state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const wasPanningRef = useRef(false);

  const redirectToLoginForGuest = useCallback(() => {
    const redirectPath = id ? `/edit/${id}` : '/edit';
    navigate(`/auth/login?next=${encodeURIComponent(redirectPath)}`);
  }, [id, navigate]);

  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    if (isTransforming) return;
    const target = e.target as HTMLElement;
    if (panMode || target.tagName !== 'CANVAS') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y };
      wasPanningRef.current = false;
    }
  }, [panOffset, panMode, isTransforming]);

  const handlePanMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPanOffset({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      wasPanningRef.current = true;
    }
  }, [isPanning, setPanOffset]);

  const handlePanMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Touch pan initiated from Canvas background (for mobile)
  const handleCanvasPanTouchStart = useCallback((clientX: number, clientY: number) => {
    if (isTransforming) return;
    setIsPanning(true);
    panStartRef.current = { x: clientX, y: clientY, panX: panOffset.x, panY: panOffset.y };
    wasPanningRef.current = false;
  }, [panOffset, isTransforming]);

  // Touch pan from main element (for panMode on mobile - canvas has pointerEvents: none)
  const handleMainTouchStart = useCallback((e: React.TouchEvent) => {
    if (!panMode || isTransforming) return;
    // Skip if pinch gesture (2+ fingers) - let zoom handler take over
    if (e.touches.length >= 2) return;
    const touch = e.touches[0];
    if (!touch) return;
    setIsPanning(true);
    panStartRef.current = { x: touch.clientX, y: touch.clientY, panX: panOffset.x, panY: panOffset.y };
    wasPanningRef.current = false;
  }, [panMode, panOffset, isTransforming]);

  // Track whether a pinch occurred during this pan session
  // to prevent the remaining finger from causing unwanted panning
  const wasPinchingRef = useRef(false);

  // Window-level touch listeners for ongoing pan
  useEffect(() => {
    if (!isPanning) return;
    wasPinchingRef.current = false;

    const handleTouchMove = (e: TouchEvent) => {
      // Mark that a pinch occurred so we stop panning after fingers separate
      if (e.touches.length >= 2) {
        wasPinchingRef.current = true;
        return;
      }
      // After a pinch, don't resume panning with the remaining finger
      if (wasPinchingRef.current) return;
      // Skip pan while transformer is active (resizing/rotating)
      if (isTransformingRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - panStartRef.current.x;
      const dy = touch.clientY - panStartRef.current.y;
      setPanOffset({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        wasPanningRef.current = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Stop panning when all fingers are lifted
      if (e.touches.length === 0) {
        setIsPanning(false);
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPanning, setPanOffset]);

  const elementOps = useElementOperations({
    setElements,
    saveToHistory,
  });

  const guestState = location.state as {
    template: Template;
    elements: CanvasElement[];
    canvasColor: string;
    name: string;
    templateId?: string;
  } | null;

  const resolvedGuestTemplate = guestTemplate ?? guestState?.template ?? null;
  const guestBanner: Banner | null = isGuest && resolvedGuestTemplate ? {
    id: 'guest',
    name: guestName || guestState?.name || 'Guest Banner',
    createdAt: guestCreatedAtRef.current,
    updatedAt: guestUpdatedAt,
    template: resolvedGuestTemplate,
    elements,
    canvasColor,
  } : null;

  const banner = isGuest ? guestBanner : bannerData;

  // Live refs read by the serialized save queue so the executor always works
  // against the latest editor state rather than values captured at enqueue time.
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const canvasColorRef = useRef(canvasColor);
  canvasColorRef.current = canvasColor;
  const saveDepsRef = useRef({ banner, id, isGuest, guestTemplate, guestState, guestName, batchSave, t });
  saveDepsRef.current = { banner, id, isGuest, guestTemplate, guestState, guestName, batchSave, t };
  const performSaveRef = useRef<(generateThumbnail: boolean) => Promise<void>>(async () => {});

  const saveQueueRef = useRef<SaveQueue<SaveRequest> | null>(null);
  if (!saveQueueRef.current) {
    saveQueueRef.current = new SaveQueue<SaveRequest>({
      execute: async (request) => {
        await performSaveRef.current(request.generateThumbnail);
      },
      merge: (previous, incoming) => ({
        generateThumbnail: previous.generateThumbnail || incoming.generateThumbnail,
      }),
    });
  }

  const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null);
  if (!debouncedSaveRef.current) {
    debouncedSaveRef.current = debounce(() => {
      saveQueueRef.current?.enqueue({ generateThumbnail: false });
    }, 3000);
  }
  const debouncedSave = debouncedSaveRef.current;

  const debouncedGuestSaveRef = useRef<ReturnType<typeof debounce> | null>(null);
  if (!debouncedGuestSaveRef.current) {
    debouncedGuestSaveRef.current = debounce(() => {
      saveQueueRef.current?.enqueue({ generateThumbnail: false });
    }, 1000);
  }
  const debouncedGuestSave = debouncedGuestSaveRef.current;

  const idlePreviewSaveRef = useRef<ReturnType<typeof debounce> | null>(null);
  if (!idlePreviewSaveRef.current) {
    idlePreviewSaveRef.current = debounce(() => {
      if (saveDepsRef.current.isGuest) return;
      saveQueueRef.current?.enqueue({ generateThumbnail: true });
    }, 10000);
  }
  const idlePreviewSave = idlePreviewSaveRef.current;

  useEffect(() => {
    if (!isGuest) return;

    if (guestState) {
      previewDirtyRef.current = false;
      setGuestTemplate(guestState.template);
      setGuestName(guestState.name);
      const guestElements = guestState.elements || [];
      setElements(guestElements);
      setCanvasColor(guestState.canvasColor || '#FFFFFF');
      prevGuestElementsRef.current = guestElements;
      prevGuestCanvasColorRef.current = guestState.canvasColor || '#FFFFFF';
      resetHistory(guestElements);
      // Initialize entrance animation tracking
      const imageCount = guestElements.filter(el => el.type === 'image').length;
      setTotalImageCount(imageCount);
      setImageLoadStatus(new Map());
      isInitialLoadRef.current = true;
      return;
    }

    // A ?template direct-open is in flight: defer entirely to the direct-open
    // effect below. Restoring a stale localStorage guest design here would race
    // and shadow the requested template (showing a previously edited episode).
    if (searchParams.get('template')) {
      return;
    }

    try {
      const stored = localStorage.getItem(guestStorageKey);
      if (stored) {
        previewDirtyRef.current = false;
        const parsed = JSON.parse(stored) as {
          name: string;
          template: Template;
          elements: CanvasElement[];
          canvasColor: string;
          updatedAt?: string;
          createdAt?: string;
        };
        setGuestTemplate(parsed.template);
        setGuestName(parsed.name);
        const parsedElements = parsed.elements || [];
        setElements(parsedElements);
        setCanvasColor(parsed.canvasColor || '#FFFFFF');
        prevGuestElementsRef.current = parsedElements;
        prevGuestCanvasColorRef.current = parsed.canvasColor || '#FFFFFF';
        resetHistory(parsedElements);
        // Initialize entrance animation tracking
        const imageCount = parsedElements.filter(el => el.type === 'image').length;
        setTotalImageCount(imageCount);
        setImageLoadStatus(new Map());
        isInitialLoadRef.current = true;
        if (parsed.createdAt) {
          guestCreatedAtRef.current = parsed.createdAt;
        }
        if (parsed.updatedAt) {
          setGuestUpdatedAt(parsed.updatedAt);
        }
        return;
      }
    } catch (error) {
      console.warn('[BannerEditor] Failed to load guest banner from localStorage:', error);
    }

    navigate('/');
  }, [guestState, guestStorageKey, isGuest, navigate, resetHistory, searchParams]);

  // Direct-open receiver for /banner?template=<id> (Gallery "Edit in IMAGINE").
  // Reuses the shared open flow (premium guard + login/guest branch). On a guest
  // design conflict we overwrite, matching the GuestLimitModal confirm behavior.
  const openTemplateFromQuery = useOpenTemplate({
    onUpgradeRequired: () => setShowUpgradeModal(true),
    onLoginRequired: () => {
      // Logged-out visitor opened a premium template via ?template link.
      // Send to login and return to this exact ?template URL afterwards, so a
      // premium member can sign in and continue straight into the editor.
      const redirectPath = `${location.pathname}${location.search}`;
      navigate(`/auth/login?next=${encodeURIComponent(redirectPath)}`);
    },
    onGuestConflict: (template) => {
      navigate('/edit', {
        state: {
          template: {
            id: template.id,
            name: template.name,
            width: template.width,
            height: template.height,
            backgroundColor: template.canvasColor,
            thumbnail: template.thumbnailUrl,
            planType: template.planType,
          },
          elements: JSON.parse(JSON.stringify(template.elements || [])),
          canvasColor: template.canvasColor,
          name: template.name,
          templateId: template.id,
        },
      });
    },
  });

  const directOpenTemplateId = searchParams.get('template');
  const directOpenHandledRef = useRef(false);
  useEffect(() => {
    // Only fire when arriving via a fresh ?template link (no editor state present).
    if (!directOpenTemplateId || guestState || directOpenHandledRef.current) {
      return;
    }
    // Wait for AuthContext to resolve before opening. Firing while auth is still
    // loading would treat a logged-in (premium) user as a guest, wrongly hitting
    // the premium guard / guest branch in useOpenTemplate.
    if (authLoading) {
      return;
    }
    directOpenHandledRef.current = true;
    void openTemplateFromQuery({
      id: directOpenTemplateId,
      name: '',
      canvasColor: '#FFFFFF',
    });
  }, [directOpenTemplateId, guestState, authLoading, openTemplateFromQuery]);

  // Initialize local state from React Query data ONLY when banner changes
  useEffect(() => {
    if (isGuest) return;
    console.log('[BannerEditor] useEffect triggered. Banner:', banner?.id, 'CurrentBannerId:', currentBannerId);

    if (!banner) {
      if (!isLoading && !id) {
        navigate(editorReturnTo);
      }
      return;
    }

    const templatePlanType = banner.template?.planType || 'free';
    if (templatePlanType === 'premium') {
      if (!profile || profile.subscriptionTier === 'free') {
        setShowUpgradeModal(true);
        return;
      }
    }

    // Only load from DB when opening a different banner
    if (banner.id !== currentBannerId) {
      console.log('[BannerEditor] Loading NEW banner from DB:', banner.id);
      console.log('[BannerEditor] Previous bannerId:', currentBannerId);
      console.log('[BannerEditor] Banner elements from DB:', banner.elements.length, 'elements');
      setCurrentBannerId(banner.id);
      previewDirtyRef.current = false;

      // Migrate existing shapes and text to new fill/stroke structure
      const migratedElements = banner.elements.map((el) => {
        if (el.type === 'shape') {
          const shape = el as ShapeElement;
          return {
            ...shape,
            fillEnabled: shape.fillEnabled !== undefined ? shape.fillEnabled : true,
            stroke: shape.stroke || '#000000',
            strokeWidth: shape.strokeWidth || 2,
            strokeEnabled: shape.strokeEnabled !== undefined ? shape.strokeEnabled : false,
            visible: shape.visible ?? true,
            locked: shape.locked ?? false,
          } as ShapeElement;
        }
        if (el.type === 'text') {
          const text = el as TextElement;
          // Migrate old strokeOnly property to new structure
          const strokeOnly = text.strokeOnly;
          return {
            ...text,
            fillEnabled: text.fillEnabled !== undefined ? text.fillEnabled : (strokeOnly === undefined ? true : !strokeOnly),
            stroke: text.stroke || text.fill || '#000000',
            strokeWidth: text.strokeWidth || Math.max(text.fontSize * 0.03, 2),
            strokeEnabled: text.strokeEnabled !== undefined ? text.strokeEnabled : (strokeOnly || false),
            letterSpacing: text.letterSpacing ?? 0,
            visible: text.visible ?? true,
            locked: text.locked ?? false,
          } as TextElement;
        }
        if (el.type === 'image') {
          const image = el as ImageElement;
          return {
            ...image,
            visible: image.visible ?? true,
            locked: image.locked ?? false,
          } as ImageElement;
        }
        return el;
      });

      console.log('[BannerEditor] Setting elements to:', migratedElements);
      setElements(migratedElements);
      setCanvasColor(banner.canvasColor);
      elementsRef.current = migratedElements;
      canvasColorRef.current = banner.canvasColor;
      prevElementsRef.current = migratedElements;
      prevCanvasColorRef.current = banner.canvasColor;
      resetHistory(migratedElements);

      // Initialize entrance animation tracking
      const imageCount = migratedElements.filter(el => el.type === 'image').length;
      setTotalImageCount(imageCount);
      setImageLoadStatus(new Map());
      isInitialLoadRef.current = true;

      // Check if migration was needed and save to DB
      const originalJSON = JSON.stringify(banner.elements);
      const migratedJSON = JSON.stringify(migratedElements);
      if (originalJSON !== migratedJSON) {
        console.log('[BannerEditor] Migration detected, saving to DB to persist changes');
        saveQueueRef.current?.enqueue({ generateThumbnail: false });
      }

      // If new banner with no elements, add default text and save to DB immediately
      if (migratedElements.length === 0) {
        console.log('[BannerEditor] Banner is empty, adding default text and saving to DB');
        const defaultText: TextElement = {
          id: `text-${Date.now()}-${Math.random()}`, // Unique ID with random component
          type: 'text',
          text: "Let's create\nyour banner\nwith IMAGINE.",
          x: banner.template.width / 2 - 200,
          y: banner.template.height / 2 - 110,
          fontSize: 60,
          fontFamily: 'Arial',
          letterSpacing: 0,
          fill: '#000000',
          fillEnabled: true,
          stroke: '#000000',
          strokeWidth: 2,
          strokeEnabled: false,
          fontWeight: 400,
          align: 'center',
          visible: true,
        };
        const newElements = [defaultText];
        setElements(newElements);
        elementsRef.current = newElements;
        prevElementsRef.current = newElements;
        resetHistory(newElements);

        console.log('[BannerEditor] Default text saved to DB');
        saveQueueRef.current?.enqueue({ generateThumbnail: false });
      }
    } else {
      console.log('[BannerEditor] Same banner, keeping local state. BannerID:', banner.id);
      // Don't log elements.length here to avoid dependency issues
    }
    // If same banner, keep local state (don't overwrite with DB)
    // Note: elements is NOT in dependency array to avoid loops
  }, [banner, banner?.id, banner?.template, currentBannerId, editorReturnTo, id, isGuest, isLoading, navigate, profile, resetHistory]);

  // Track if there are unsaved changes and save status
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const generatePreviewAssets = useCallback(async (): Promise<{
    thumbnailDataURL: string | undefined;
    fullresDataURL: string | undefined;
  }> => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { thumbnailDataURL: undefined, fullresDataURL: undefined };
    }

    await canvas.waitForNextRender();

    const rawThumbnail = canvas.exportThumbnail();
    const rawFullres = canvas.exportFullresPreview();

    return {
      thumbnailDataURL: rawThumbnail && rawThumbnail.length >= 100 ? rawThumbnail : undefined,
      fullresDataURL: rawFullres && rawFullres.length >= 100 ? rawFullres : undefined,
    };
  }, []);

  // Core save function. Reads current state from refs so queued saves never run
  // against stale values captured at debounce/enqueue time.
  const performSave = useCallback(async (generateThumbnail = false) => {
    const { banner, id, isGuest, guestTemplate, guestState, guestName, batchSave, t } = saveDepsRef.current;
    const elements = elementsRef.current;
    const canvasColor = canvasColorRef.current;

    if (isGuest) {
      if (!guestTemplate && !guestState?.template) return;
      setSaveStatus('saving');
      setLastSaveError(null);
      try {
        let thumbnailDataURL: string | undefined;
        let fullresDataURL: string | undefined;
        if (generateThumbnail && canvasRef.current) {
          console.log('[BannerEditor Guest] Generating thumbnail...');
          ({ thumbnailDataURL, fullresDataURL } = await generatePreviewAssets());
          console.log('[BannerEditor Guest] Thumbnail generated:', thumbnailDataURL ? `${thumbnailDataURL.substring(0, 50)}... (length: ${thumbnailDataURL.length})` : 'NONE');
        } else {
          console.log('[BannerEditor Guest] Skipping thumbnail generation - generateThumbnail:', generateThumbnail, 'hasCanvas:', !!canvasRef.current);
        }

        const updatedAt = new Date().toISOString();
        const snapshot = {
          name: guestName || guestState?.name || 'Guest Banner',
          template: guestTemplate || guestState?.template,
          elements,
          canvasColor,
          updatedAt,
          createdAt: guestCreatedAtRef.current,
          thumbnailUrl: thumbnailDataURL,
          fullresUrl: fullresDataURL,
        };
        console.log('[BannerEditor Guest] Saving to localStorage with assets:', {
          hasThumbnail: !!thumbnailDataURL,
          hasFullres: !!fullresDataURL,
        });
        localStorage.setItem(guestStorageKey, JSON.stringify(snapshot));
        setGuestUpdatedAt(updatedAt);
        setHasUnsavedChanges(false);
        if (generateThumbnail && (thumbnailDataURL || fullresDataURL)) {
          previewDirtyRef.current = false;
        }
        setSaveStatus('saved');
        console.log('[BannerEditor Guest] Save complete');
      } catch (error) {
        console.error('[BannerEditor] Guest save failed:', error);
        setSaveStatus('error');
        setLastSaveError(error instanceof Error ? error.message : t('message:error.saveFailed'));
      }
      return;
    }
    if (!banner || !id) return;

    console.log('[BannerEditor] Saving... Elements:', elements.length, 'Banner ID:', banner.id);
    setSaveStatus('saving');
    setLastSaveError(null);

    try {
      let thumbnailDataURL: string | undefined;
      let fullresDataURL: string | undefined;

      if (generateThumbnail && canvasRef.current) {
        console.log('[BannerEditor] 🎨 GENERATING PREVIEW ASSETS...');
        ({ thumbnailDataURL, fullresDataURL } = await generatePreviewAssets());
        console.log('[BannerEditor] 🎨 Assets generated:', {
          thumbnailLength: thumbnailDataURL?.length || 0,
          fullresLength: fullresDataURL?.length || 0,
        });
      } else {
        console.log('[BannerEditor] ⏭️  SKIPPING asset generation (generateThumbnail:', generateThumbnail, ', hasCanvas:', !!canvasRef.current, ')');
      }

      console.log('[BannerEditor] Calling batchSave with', elements.length, 'elements, assets:', {
        hasThumbnail: !!thumbnailDataURL,
        hasFullres: !!fullresDataURL,
      });
      const result = await batchSave.mutateAsync({
        elements,
        canvasColor,
        thumbnailDataURL,
        fullresDataURL,
      });

      setHasUnsavedChanges(false);
      if ((result as { thumbnailError?: unknown; fullresError?: unknown } | null)?.thumbnailError ||
          (result as { thumbnailError?: unknown; fullresError?: unknown } | null)?.fullresError) {
        setSaveStatus('error');
        setLastSaveError(t('message:error.saveFailed'));
      } else {
        if (generateThumbnail && (thumbnailDataURL || fullresDataURL)) {
          previewDirtyRef.current = false;
        }
        setSaveStatus('saved');
        console.log('[BannerEditor] ✅ Save successful');
      }
    } catch (error) {
      console.error('[BannerEditor] Save failed:', error);
      setSaveStatus('error');
      setLastSaveError(error instanceof Error ? error.message : t('message:error.saveFailed'));
    }
  }, [generatePreviewAssets, guestStorageKey]);

  performSaveRef.current = performSave;

  // Flush the save pipeline immediately. `generateThumbnail` is used for
  // explicit save/leave actions so list thumbnails are refreshed before exit.
  const flushQueuedSave = useCallback(async (generateThumbnail: boolean) => {
    const currentBanner = saveDepsRef.current.banner;
    const previewNeedsRefresh = generateThumbnail && (
      previewDirtyRef.current ||
      saveDepsRef.current.isGuest ||
      (!!currentBanner && (!currentBanner.thumbnailUrl || !currentBanner.fullresUrl))
    );
    const hasPendingWork = hasUnsavedChanges || saveQueueRef.current?.isBusy || previewNeedsRefresh;

    if (!hasPendingWork) return;

    debouncedSave.cancel();
    debouncedGuestSave.cancel();
    idlePreviewSave.cancel();
    saveQueueRef.current?.enqueue({ generateThumbnail });
    await saveQueueRef.current?.flush();
  }, [hasUnsavedChanges, debouncedSave, debouncedGuestSave, idlePreviewSave]);

  // Immediate save for important editor mutations that do not need fresh
  // preview assets yet.
  const immediateSave = useCallback(async () => {
    await flushQueuedSave(false);
  }, [flushQueuedSave]);

  // Mark as dirty and trigger auto-save when elements actually change.
  useEffect(() => {
    if (isGuest) return;

    // Skip on initial mount
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      prevElementsRef.current = elements;
      return;
    }

    const banner = saveDepsRef.current.banner;
    if (elements !== prevElementsRef.current && banner && currentBannerId === banner.id) {
      console.log('[BannerEditor] Elements actually changed, triggering auto-save');
      prevElementsRef.current = elements;
      previewDirtyRef.current = true;
      setHasUnsavedChanges(true);
      setSaveStatus('unsaved');
      debouncedSave();
      idlePreviewSave();
    };
  }, [elements, currentBannerId, isGuest, debouncedSave, idlePreviewSave]);

  useEffect(() => {
    if (!isGuest) return;

    if (!guestMountedRef.current) {
      guestMountedRef.current = true;
      prevGuestElementsRef.current = elements;
      prevGuestCanvasColorRef.current = canvasColor;
      return;
    }

    if (elements !== prevGuestElementsRef.current) {
      prevGuestElementsRef.current = elements;
      previewDirtyRef.current = true;
      setHasUnsavedChanges(true);
      setSaveStatus('unsaved');
      debouncedGuestSave();
    }
  }, [elements, canvasColor, debouncedGuestSave, isGuest]);

  // Mark as dirty and trigger auto-save when canvas color actually changes.
  useEffect(() => {
    if (isGuest) return;
    if (!isMountedRef.current) return;

    const banner = saveDepsRef.current.banner;
    if (canvasColor !== prevCanvasColorRef.current && banner && currentBannerId === banner.id) {
      console.log('[BannerEditor] Canvas color changed, triggering auto-save');
      prevCanvasColorRef.current = canvasColor;
      previewDirtyRef.current = true;
      setHasUnsavedChanges(true);
      setSaveStatus('unsaved');
      debouncedSave();
      idlePreviewSave();
    }
  }, [canvasColor, currentBannerId, isGuest, debouncedSave, idlePreviewSave]);

  useEffect(() => {
    if (!isGuest) return;
    if (!guestMountedRef.current) return;

    if (canvasColor !== prevGuestCanvasColorRef.current) {
      prevGuestCanvasColorRef.current = canvasColor;
      previewDirtyRef.current = true;
      setHasUnsavedChanges(true);
      setSaveStatus('unsaved');
      debouncedGuestSave();
    }
  }, [canvasColor, debouncedGuestSave, isGuest]);

  // Save before leaving page (best effort only).
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges) {
        debouncedSave.cancel();
        debouncedGuestSave.cancel();
        idlePreviewSave.cancel();
        saveQueueRef.current?.enqueue({ generateThumbnail: false });
        void saveQueueRef.current?.flush();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, debouncedGuestSave, debouncedSave, idlePreviewSave]);

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
      debouncedGuestSave.cancel();
      idlePreviewSave.cancel();
    };
  }, [debouncedSave, debouncedGuestSave, idlePreviewSave]);

  // Manual save handler (for save button)
  const handleSave = async () => {
    await flushQueuedSave(true);
  };

  // Copy (with localStorage for cross-banner support)
  const handleCopy = () => {
    if (selectedElementIds.length === 0) return;

    const elementsToCopy = elements.filter((el) => selectedElementIds.includes(el.id));
    if (elementsToCopy.length > 0) {
      const clonedElements = JSON.parse(JSON.stringify(elementsToCopy));
      setCopiedElements(clonedElements);
      // Save to localStorage for cross-banner paste
      try {
        localStorage.setItem('whatif_clipboard', JSON.stringify(clonedElements));
        console.log(`${clonedElements.length} element(s) copied to clipboard (cross-banner enabled)`);
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    }
  };

  // Paste (with localStorage for cross-banner support)
  const handlePaste = () => {
    let elementsToPaste = copiedElements.length > 0 ? copiedElements : null;

    // Try to get from localStorage if no local copy
    if (!elementsToPaste || elementsToPaste.length === 0) {
      try {
        const stored = localStorage.getItem('whatif_clipboard');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Support both old format (single element) and new format (array)
          elementsToPaste = Array.isArray(parsed) ? parsed : [parsed];
          console.log(`${elementsToPaste.length} element(s) retrieved from cross-banner clipboard`);
        }
      } catch (error) {
        console.error('Failed to read from localStorage:', error);
      }
    }

    if (elementsToPaste && elementsToPaste.length > 0) {
      const newIds: string[] = [];
      const timestamp = Date.now();
      elementsToPaste.forEach((element, index) => {
        const newId = `${element.type}-${timestamp}-${index}`;
        const newElement: CanvasElement = {
          ...element,
          id: newId,
          x: element.x + 20,
          y: element.y + 20,
        } as CanvasElement;
        elementOps.addElement(newElement);
        newIds.push(newId);
      });
      setSelectedElementIds(newIds);
    }
  };

  // Delete
  const handleDelete = () => {
    if (selectedElementIds.length > 0) {
      elementOps.deleteElements(selectedElementIds);
      setSelectedElementIds([]);

      // Immediate save for element deletion
      immediateSave();
    }
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    const prevElements = undo();
    if (prevElements) {
      setElements(prevElements);
    }
  };

  const handleRedo = () => {
    const nextElements = redo();
    if (nextElements) {
      setElements(nextElements);
    }
  };

  // Arrow key movement handlers (Photoshop-style: 1px normal, 10px with Shift)
  const handleMoveUp = (distance: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) => ({
        y: el.y - distance,
      }));
    }
  };

  const handleMoveDown = (distance: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) => ({
        y: el.y + distance,
      }));
    }
  };

  const handleMoveLeft = (distance: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) => ({
        x: el.x - distance,
      }));
    }
  };

  const handleMoveRight = (distance: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) => ({
        x: el.x + distance,
      }));
    }
  };

  // Update selection state and sync properties for single text element
  const handleSelectElement = useCallback((ids: string[]) => {
    setSelectedElementIds(ids);
    if (ids.length === 1) {
      const element = elements.find((el) => el.id === ids[0]);
      if (element && element.type === 'text') {
        setSelectedFont(element.fontFamily);
        setSelectedSize(element.fontSize);
        setSelectedWeight(element.fontWeight);
        setSelectedLetterSpacing(element.letterSpacing ?? 0);
        setSelectedLineHeight(element.lineHeight ?? 1);
        setSelectedTextColor(element.fill);
      }
    }
  }, [elements]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDelete: handleDelete,
    onSave: handleSave,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onMoveLeft: handleMoveLeft,
    onMoveRight: handleMoveRight,
  });

  const handleCanvasPlaceText = useCallback((x: number, y: number): string => {
    setTextPlacementMode(false);
    const newId = `text-${Date.now()}`;
    const newElement: TextElement = {
      id: newId,
      type: 'text',
      text: 'Text',
      x,
      y,
      fontSize: selectedSize,
      fontFamily: selectedFont,
      letterSpacing: selectedLetterSpacing,
      lineHeight: selectedLineHeight,
      fill: selectedTextColor,
      fillEnabled: true,
      stroke: '#000000',
      strokeWidth: 2,
      strokeEnabled: false,
      fontWeight: selectedWeight,
      visible: true,
    };
    elementOps.addElement(newElement);
    setSelectedElementIds([newId]);
    immediateSave();
    return newId;
  }, [selectedSize, selectedFont, selectedLetterSpacing, selectedLineHeight, selectedTextColor, selectedWeight, elementOps, immediateSave]);

  // Cancel text placement mode on Escape
  useEffect(() => {
    if (!textPlacementMode) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTextPlacementMode(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [textPlacementMode]);

  if (!banner) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">{t('common:status.loading')}</p>
        </div>
        {/* Guest/free users opening a premium template via ?template land here with
            banner=null. Without this, setShowUpgradeModal(true) is masked by the early
            return and the user is stuck on an infinite spinner. Surface the upgrade/login
            flow instead. */}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => {
            setShowUpgradeModal(false);
            navigate(editorReturnTo);
          }}
        />
      </div>
    );
  }

  const handleAddText = () => {
    setTextPlacementMode(prev => !prev);
  };

  const handleAddShape = (shapeType: 'rectangle' | 'triangle' | 'star' | 'circle' | 'heart') => {
    const newId = `shape-${Date.now()}`;
    const newShape: ShapeElement = {
      id: newId,
      type: 'shape',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      fill: '#000000',
      fillEnabled: true,
      stroke: '#000000',
      strokeWidth: 2,
      strokeEnabled: false,
      shapeType,
      visible: true,
    };
    elementOps.addElement(newShape);
    setSelectedElementIds([newId]);

    // Immediate save for element addition
    immediateSave();
  };

  const handleAddImage = async (src: string, width: number, height: number) => {
    const newId = `image-${Date.now()}-${Math.random()}`;
    let finalSrc = src;

    if (isDataUrlImage(src)) {
      if (!user) {
        alert(t('message:error.imageLoginRequired'));
        redirectToLoginForGuest();
        return;
      }
      try {
        const { blob, mimeType, extension } = dataUrlToBlob(src);
        const key = buildUserUploadKey(user.id, crypto.randomUUID(), extension);
        // Store the relative asset key in element.src (resolved at render time);
        // the user_images row records the same full key.
        finalSrc = await uploadAsset(key, blob, mimeType);

        await insertUserImageRecord({
          userId: user.id,
          name: `image-${Date.now()}`,
          storagePath: finalSrc,
          width,
          height,
          fileSize: blob.size,
          assetScope: 'user',
          sourceContext: 'editor',
          assetRole: 'general',
        });
      } catch (error) {
        console.error('Image upload failed:', error);
        alert(t('message:error.imageUploadFailed'));
        return;
      }
    }

    setElements(prevElements => {
      const newImage: ImageElement = {
        id: newId,
        type: 'image',
        x: (banner.template.width - width) / 2,
        y: (banner.template.height - height) / 2,
        src: finalSrc,
        width,
        height,
        visible: true,
      };

      const newElements = [...prevElements, newImage];
      // Save to history after state update
      setTimeout(() => saveToHistory(newElements), 0);
      return newElements;
    });

    setSelectedElementIds([newId]);

    // Immediate save for image addition
    immediateSave();
  };

  const handleImageDrop = async (file: File, width: number, height: number) => {
    const newId = `image-${Date.now()}-${Math.random()}`;
    if (!user) {
      alert(t('message:error.imageLoginRequired'));
      redirectToLoginForGuest();
      return;
    }

    let imageKey = '';
    try {
      const extension = getExtensionFromMime(file.type || '');
      const key = buildUserUploadKey(user.id, crypto.randomUUID(), extension);
      // element.src holds the relative asset key; the user_images row records
      // the same full key so it shows up in the Uploads tab.
      imageKey = await uploadAsset(key, file, file.type || 'application/octet-stream');

      await insertUserImageRecord({
        userId: user.id,
        name: file.name,
        storagePath: imageKey,
        width,
        height,
        fileSize: file.size,
        assetScope: 'user',
        sourceContext: 'editor',
        assetRole: 'general',
      });
    } catch (error) {
      console.error('Image upload failed:', error);
      alert(t('message:error.imageUploadFailed'));
      return;
    }

    setElements(prevElements => {
      const newImage: ImageElement = {
        id: newId,
        type: 'image',
        x: (banner.template.width - width) / 2,
        y: (banner.template.height - height) / 2,
        src: imageKey,
        width,
        height,
        visible: true,
      };

      const newElements = [...prevElements, newImage];
      // Save to history after state update
      setTimeout(() => saveToHistory(newElements), 0);
      return newElements;
    });

    setSelectedElementIds([newId]);

    // Immediate save for image drop
    immediateSave();
  };

  const handleTextChange = (id: string, newText: string) => {
    elementOps.updateElement(id, { text: newText });
  };

  const handleFontChange = (font: string) => {
    setSelectedFont(font);
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        el.type === 'text' ? { fontFamily: font } : {}
      );
    }
  };

  const handleSizeChange = (size: number) => {
    setSelectedSize(size);
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        el.type === 'text' ? { fontSize: size } : {}
      );
    }
  };

  const handleWeightChange = (weight: number) => {
    setSelectedWeight(weight);
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        el.type === 'text' ? { fontWeight: weight } : {}
      );
    }
  };

  const handleLetterSpacingChange = (letterSpacing: number) => {
    setSelectedLetterSpacing(letterSpacing);
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        el.type === 'text' ? { letterSpacing } : {}
      );
    }
  };

  const handleLineHeightChange = (lineHeight: number) => {
    setSelectedLineHeight(lineHeight);
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        el.type === 'text' ? { lineHeight } : {}
      );
    }
  };

  const handleAlignChange = (align: 'left' | 'center' | 'right') => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        el.type === 'text' ? { align } : {}
      );
    }
  };

  const handlePropertyColorChange = (color: string) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        (el.type === 'text' || el.type === 'shape') ? { fill: color } : {}
      );

      // Update text color state if single text element is selected
      if (selectedElementIds.length === 1) {
        const selectedElement = elements.find((el) => el.id === selectedElementIds[0]);
        if (selectedElement && selectedElement.type === 'text') {
          setSelectedTextColor(color);
        }
      }
    }
  };

  const handleOpacityChange = (opacity: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, () => ({ opacity }));
    }
  };

  const handleBringToFront = () => {
    elementOps.bringToFront(selectedElementIds);
  };

  const handleSendToBack = () => {
    elementOps.sendToBack(selectedElementIds);
  };

  const handleElementUpdate = (id: string, updates: Partial<CanvasElement>) => {
    elementOps.updateElement(id, updates);
  };

  const handleElementsUpdate = (ids: string[], updateFn: (element: CanvasElement) => Partial<CanvasElement>) => {
    elementOps.updateElements(ids, updateFn);
  };

  const handleToggleLock = (id: string) => {
    const element = elements.find(el => el.id === id);
    if (element) {
      const willLock = !element.locked;
      elementOps.updateElement(id, { locked: willLock });
      if (willLock) {
        setSelectedElementIds(prev => prev.filter(sid => sid !== id));
      }
    }
  };

  const handleToggleVisibility = (id: string) => {
    const element = elements.find(el => el.id === id);
    if (!element) return;
    const nextVisible = !(element.visible ?? true);
    elementOps.updateElement(id, { visible: nextVisible });
    if (!nextVisible) {
      setSelectedElementIds((prev) => prev.filter((selectedId) => selectedId !== id));
    }
  };

  // Shape fill/stroke handlers
  const handleFillEnabledChange = (enabled: boolean) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        (el.type === 'shape' || el.type === 'text') ? { fillEnabled: enabled } : {}
      );
    }
  };

  const handleStrokeChange = (color: string) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        (el.type === 'shape' || el.type === 'text') ? { stroke: color } : {}
      );
    }
  };

  const handleStrokeWidthChange = (width: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        (el.type === 'shape' || el.type === 'text') ? { strokeWidth: width } : {}
      );
    }
  };

  const handleStrokeEnabledChange = (enabled: boolean) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        (el.type === 'shape' || el.type === 'text') ? { strokeEnabled: enabled } : {}
      );
    }
  };

  // Shadow handlers
  const handleShadowEnabledChange = (enabled: boolean) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, () => ({ shadowEnabled: enabled }));
    }
  };

  const handleShadowColorChange = (color: string) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, () => ({ shadowColor: color }));
    }
  };

  const handleShadowBlurChange = (blur: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, () => ({ shadowBlur: blur }));
    }
  };

  const handleShadowOffsetXChange = (offset: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, () => ({ shadowOffsetX: offset }));
    }
  };

  const handleShadowOffsetYChange = (offset: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, () => ({ shadowOffsetY: offset }));
    }
  };

  const handleShadowOpacityChange = (opacity: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, () => ({ shadowOpacity: opacity }));
    }
  };

  const handleImageBlurChange = (blur: number) => {
    if (selectedElementIds.length > 0) {
      elementOps.updateElements(selectedElementIds, (el) =>
        el.type === 'image' ? { blurRadius: blur } : {}
      );
    }
  };

  // Get element dimensions (from data or from rendered Konva node for text)
  const getElementSize = (el: CanvasElement): { w: number; h: number } => {
    if (el.type === 'image' || el.type === 'shape') {
      const sized = el as ImageElement | ShapeElement;
      return { w: sized.width, h: sized.height };
    }
    // Text elements: read actual size from the rendered Konva node
    const nodesMap = canvasRef.current?.getNodesMap();
    const node = nodesMap?.get(el.id);
    if (node) {
      return { w: node.width() * (node.scaleX?.() ?? 1), h: node.height() * (node.scaleY?.() ?? 1) };
    }
    return { w: 0, h: 0 };
  };

  // Center selected elements horizontally on canvas
  const handleCenterHorizontal = () => {
    if (selectedElementIds.length === 0 || !banner) return;
    const cw = banner.template.width;
    selectedElementIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (!el) return;
      const { w } = getElementSize(el);
      elementOps.updateElement(id, { x: (cw - w) / 2 });
    });
  };

  // Center selected elements vertically on canvas
  const handleCenterVertical = () => {
    if (selectedElementIds.length === 0 || !banner) return;
    const ch = banner.template.height;
    selectedElementIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (!el) return;
      const { h } = getElementSize(el);
      elementOps.updateElement(id, { y: (ch - h) / 2 });
    });
  };

  // Fit selected image to canvas while preserving aspect ratio
  const handleFitToCanvas = () => {
    if (selectedElementIds.length !== 1 || !banner) return;
    const el = elements.find(e => e.id === selectedElementIds[0]);
    if (!el || el.type !== 'image') return;
    const imageEl = el as ImageElement;
    const placement = getFitToCanvasPlacement(
      banner.template.width,
      banner.template.height,
      imageEl.width,
      imageEl.height,
    );

    elementOps.updateElement(imageEl.id, {
      width: placement.width,
      height: placement.height,
      x: placement.x,
      y: placement.y,
    });
  };

  // Generate a black silhouette copy of the selected image as a shadow layer
  const handleGenerateShadow = async () => {
    if (selectedElementIds.length !== 1) return;
    const sourceElement = elements.find(el => el.id === selectedElementIds[0]);
    if (!sourceElement || sourceElement.type !== 'image') return;
    const imageEl = sourceElement as ImageElement;

    if (!user) {
      alert(t('message:error.imageLoginRequired'));
      redirectToLoginForGuest();
      return;
    }

    setIsGeneratingShadow(true);
    try {
      // imageEl.src is a relative asset key; resolve it before loading pixels.
      const silhouetteBlob = await createSilhouetteBlob(resolveElementSrc(imageEl.src));
      const key = buildUserUploadKey(user.id, crypto.randomUUID(), 'png');
      const publicUrl = await uploadAsset(key, silhouetteBlob, 'image/png');

      await insertUserImageRecord({
        userId: user.id,
        name: 'shadow.png',
        storagePath: publicUrl,
        width: imageEl.width,
        height: imageEl.height,
        fileSize: silhouetteBlob.size,
        assetScope: 'user',
        sourceContext: 'editor',
        assetRole: 'shadow',
      });

      // 45-degree offset (down-right)
      const offset = Math.min(imageEl.width, imageEl.height) * 0.05;
      const shadowId = `image-${Date.now()}-${Math.random()}`;

      setElements(prevElements => {
        const sourceIndex = prevElements.findIndex(el => el.id === imageEl.id);
        const shadowElement: ImageElement = {
          id: shadowId,
          type: 'image',
          x: imageEl.x + offset,
          y: imageEl.y + offset,
          src: publicUrl,
          width: imageEl.width,
          height: imageEl.height,
          rotation: imageEl.rotation,
          opacity: 0.3,
          visible: true,
        };

        // Insert shadow just behind the source element
        const newElements = [...prevElements];
        newElements.splice(sourceIndex, 0, shadowElement);
        setTimeout(() => saveToHistory(newElements), 0);
        return newElements;
      });

      setSelectedElementIds([shadowId]);
      immediateSave();
    } catch (error) {
      // Surface failures instead of swallowing them silently.
      console.error('Failed to generate shadow:', error);
      alert(t('message:error.imageGenerationFailed'));
    } finally {
      setIsGeneratingShadow(false);
    }
  };

  const handleBannerNameChange = async (newName: string) => {
    if (isGuest) return;
    await updateName.mutateAsync(newName);
  };


  const handleReorderElements = (newOrder: CanvasElement[]) => {
    elementOps.reorderElements(newOrder);
  };

  const handleCanvasSizeChange = async (width: number, height: number) => {
    if (isGuest) {
      const baseTemplate = guestTemplate || banner?.template;
      if (baseTemplate) {
        setGuestTemplate({
          ...baseTemplate,
          width,
          height,
        });
      }
      return;
    }
    if (banner) {
      const updatedTemplate: Template = {
        ...banner.template,
        width,
        height,
      };
      await updateBanner.mutateAsync({ template: updatedTemplate });
    }
  };

  const handleExport = async () => {
    if (!canvasRef.current || !banner) return;

    try {
      const dataURL = canvasRef.current.exportImage();

      if (!dataURL || dataURL.length < 100) {
        alert(t('message:error.imageGenerationFailed'));
        console.error('Export failed: invalid data URL');
        return;
      }

      const exportResult = await exportImageFromDataUrl(dataURL, `${banner.name}.png`);
      console.log('Export successful, size:', dataURL.length, 'method:', exportResult.method);

      if (exportResult.isIOS && exportResult.method !== 'share-files') {
        alert(t('message:info.saveImageGuide'));
      }

      if (exportResult.inAppBrowser) {
        alert(t('message:info.inAppBrowserGuide'));
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error exporting image:', error);
      alert(t('message:error.exportFailed'));
    }
  };

  const handleInternalNavigation = async (target: string) => {
    if (isNavigating) return;

    setIsNavigating(true);

    try {
      await flushQueuedSave(true);
      navigate(target);
    } catch (error) {
      console.error('[BannerEditor] Failed to save before navigating:', error);
      const confirmLeave = window.confirm(t('banner:saveFailedConfirm'));
      if (confirmLeave) {
        navigate(target);
      }
    } finally {
      setIsNavigating(false);
    }
  };

  const handleBackToManager = async () => {
    await handleInternalNavigation(editorReturnTo);
  };

  const isBannerLoading = !isGuest && (isLoading || !banner);
  if (isBannerLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">{t('common:status.loading')}</p>
        </div>
      </div>
    );
  }
  if (!banner) {
    return null;
  }

  const handleSaveAsTemplate = () => {
    // Only allow admins to save as template
    if (profile?.role !== 'admin') {
      return;
    }
    setShowSaveAsTemplateModal(true);
  };

  const handleTemplateModalSave = async ({ planType, displayOrder }: { planType: 'free' | 'premium'; displayOrder: number }) => {
    try {
      // Generate thumbnail for the template
      const thumbnailDataUrl = canvasRef.current?.exportThumbnail();
      if (!thumbnailDataUrl) {
        console.error('Failed to generate thumbnail');
        return;
      }

      // Create the template first to obtain its id, then upload the thumbnail
      // to the template's OWN deterministic R2 key and record that key.
      const templateId = await templateStorage.createTemplate({
        name: banner.name,
        elements: elements,
        canvasColor: canvasColor,
        planType: planType,
        displayOrder: displayOrder,
        width: banner.template.width,
        height: banner.template.height,
      });

      if (templateId) {
        const { blob, mimeType } = dataUrlToBlob(thumbnailDataUrl);
        const key = await uploadAsset(
          buildTemplateThumbKey(templateId, createAssetRevision()),
          blob,
          mimeType,
        );
        await templateStorage.setTemplateThumbnailKey(templateId, key);
      }

      // モーダル側で閉じる処理とメッセージ表示を行う
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error; // モーダル側で catch してエラー表示
    }
  };

  return (
    <div className="h-[100svh] flex flex-col bg-[#1e1e1e]">
      <Header
        onBackToManager={handleBackToManager}
        onInternalNavigate={handleInternalNavigation}
        bannerName={banner.name}
        bannerId={isGuest ? undefined : banner.id}
        onBannerNameChange={isGuest ? undefined : handleBannerNameChange}
        isAdmin={profile?.role === 'admin'}
        onSaveAsTemplate={handleSaveAsTemplate}
      />


      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <Sidebar
          canvasColor={canvasColor}
          canvasWidth={banner.template.width}
          canvasHeight={banner.template.height}
          onSelectColor={setCanvasColor}
          onCanvasSizeChange={handleCanvasSizeChange}
          onAddText={handleAddText}
          onAddShape={handleAddShape}
          onAddImage={handleAddImage}
          elements={elements}
          selectedElementIds={selectedElementIds}
          onSelectElement={handleSelectElement}
          onReorderElements={handleReorderElements}
          onToggleLock={handleToggleLock}
          onToggleVisibility={handleToggleVisibility}
          textPlacementMode={textPlacementMode}
          panMode={panMode}
          onPanModeChange={setPanMode}
        />

        <main
          ref={mainRef}
          className="flex-1 overflow-hidden bg-[#151515] flex items-center justify-center"
          style={{ touchAction: 'none', cursor: textPlacementMode ? 'text' : (panMode || isPanning) ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={handlePanMouseDown}
          onMouseMove={handlePanMouseMove}
          onMouseUp={handlePanMouseUp}
          onMouseLeave={handlePanMouseUp}
          onTouchStart={handleMainTouchStart}
          onClick={(e) => {
            if (wasPanningRef.current) {
              wasPanningRef.current = false;
              return;
            }
            const target = e.target as HTMLElement;
            const isCanvasStage = target.tagName === 'CANVAS';
            if (!isCanvasStage) {
              handleSelectElement([]);
            }
          }}
        >
          <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)`, cursor: isPanning ? 'grabbing' : 'default', pointerEvents: panMode ? 'none' : 'auto' }} className="relative">
            <Suspense fallback={<div className="h-[320px] w-[320px] rounded-2xl border border-white/10 bg-[#202020]" />}>
              <EditorCanvas
                  ref={canvasRef}
                  template={banner.template}
                  elements={elements}
                  scale={safeZoom / 100}
                  canvasColor={canvasColor}
                  fileName={`${banner.name}.png`}
                  onTextChange={handleTextChange}
                  selectedElementIds={selectedElementIds}
                  onSelectElement={handleSelectElement}
                  onElementUpdate={handleElementUpdate}
                  onElementsUpdate={handleElementsUpdate}
                  onImageDrop={handleImageDrop}
                  onImageLoad={handleImageLoad}
                  entranceAnimationPhase={animationPhase}
                  textPlacementMode={textPlacementMode}
                  onPlaceText={handleCanvasPlaceText}
                  onEditingChange={setIsCanvasEditing}
                  onBackgroundTouchStart={handleCanvasPanTouchStart}
                  onTransformingChange={handleTransformingChange}
                />
            </Suspense>
            {(animationPhase === 'loading' || animationPhase === 'animating') && (
              <LoadingOverlay
                elements={elements}
                template={banner.template}
                scale={safeZoom / 100}
                phase={animationPhase}
                canvasColor={canvasColor}
              />
            )}
          </div>
        </main>

        <PropertyPanel
          selectedElement={selectedElementIds.length === 1 ? elements.find((el) => el.id === selectedElementIds[0]) || null : null}
          onColorChange={handlePropertyColorChange}
          onFontChange={handleFontChange}
          onSizeChange={handleSizeChange}
          onWeightChange={handleWeightChange}
          onLetterSpacingChange={handleLetterSpacingChange}
          onLineHeightChange={handleLineHeightChange}
          onAlignChange={handleAlignChange}
          onOpacityChange={handleOpacityChange}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onFillEnabledChange={handleFillEnabledChange}
          onStrokeChange={handleStrokeChange}
          onStrokeWidthChange={handleStrokeWidthChange}
          onStrokeEnabledChange={handleStrokeEnabledChange}
          onShadowEnabledChange={handleShadowEnabledChange}
          onShadowColorChange={handleShadowColorChange}
          onShadowBlurChange={handleShadowBlurChange}
          onShadowOffsetXChange={handleShadowOffsetXChange}
          onShadowOffsetYChange={handleShadowOffsetYChange}
          onShadowOpacityChange={handleShadowOpacityChange}
          onImageBlurChange={handleImageBlurChange}
          onGenerateShadow={handleGenerateShadow}
          isGeneratingShadow={isGeneratingShadow}
          onFitToCanvas={handleFitToCanvas}
          selectedCount={selectedElementIds.length}
          selectedElements={elements.filter(el => selectedElementIds.includes(el.id))}
          onCenterHorizontal={handleCenterHorizontal}
          onCenterVertical={handleCenterVertical}
        />
      </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden relative">
        {/* Mobile floating toolbar: Select / Pan / Undo */}
        <div className="absolute top-3 right-3 z-40 flex gap-2">
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
            onClick={handleUndo}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-lg active:scale-95 transition-transform text-white"
            aria-label="Undo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H7" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6L3 10l4 4" />
            </svg>
          </button>
        </div>

        <main
          ref={mainRef}
          className="flex-1 overflow-hidden bg-[#151515] flex items-center justify-center"
          style={{ touchAction: 'none', cursor: textPlacementMode ? 'text' : (panMode || isPanning) ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={handlePanMouseDown}
          onMouseMove={handlePanMouseMove}
          onMouseUp={handlePanMouseUp}
          onMouseLeave={handlePanMouseUp}
          onTouchStart={handleMainTouchStart}
          onClick={(e) => {
            if (wasPanningRef.current) {
              wasPanningRef.current = false;
              return;
            }
            const target = e.target as HTMLElement;
            const isCanvasStage = target.tagName === 'CANVAS';
            if (!isCanvasStage) {
              handleSelectElement([]);
            }
          }}
        >
          <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)`, cursor: isPanning ? 'grabbing' : 'default', pointerEvents: panMode ? 'none' : 'auto' }} className="relative">
            <Suspense fallback={<div className="h-[320px] w-[320px] rounded-2xl border border-white/10 bg-[#202020]" />}>
              <EditorCanvas
                  ref={canvasRef}
                  template={banner.template}
                  elements={elements}
                  scale={safeZoom / 100}
                  canvasColor={canvasColor}
                  fileName={`${banner.name}.png`}
                  onTextChange={handleTextChange}
                  selectedElementIds={selectedElementIds}
                  onSelectElement={handleSelectElement}
                  onElementUpdate={handleElementUpdate}
                  onElementsUpdate={handleElementsUpdate}
                  onImageDrop={handleImageDrop}
                  onImageLoad={handleImageLoad}
                  entranceAnimationPhase={animationPhase}
                  textPlacementMode={textPlacementMode}
                  onPlaceText={handleCanvasPlaceText}
                  onEditingChange={setIsCanvasEditing}
                  onBackgroundTouchStart={handleCanvasPanTouchStart}
                  onTransformingChange={handleTransformingChange}
                />
            </Suspense>
            {(animationPhase === 'loading' || animationPhase === 'animating') && (
              <LoadingOverlay
                elements={elements}
                template={banner.template}
                scale={safeZoom / 100}
                phase={animationPhase}
                canvasColor={canvasColor}
              />
            )}
          </div>
        </main>

        {/* Mobile Toolbar - Floating buttons + Drawer */}
        <MobileToolbar
          canvasColor={canvasColor}
          onSelectColor={setCanvasColor}
          onAddText={handleAddText}
          onAddShape={handleAddShape}
          onAddImage={handleAddImage}
          elements={elements}
          selectedElementIds={selectedElementIds}
          onSelectElement={handleSelectElement}
          onReorderElements={handleReorderElements}
          onToggleLock={handleToggleLock}
          onToggleVisibility={handleToggleVisibility}
          textPlacementMode={textPlacementMode}
          panMode={panMode}
          onPanModeChange={setPanMode}
        />

        {/* Mobile PropertyPanel - Hidden during inline text editing */}
        {!isCanvasEditing && (
          <PropertyPanel
            selectedElement={selectedElementIds.length === 1 ? elements.find((el) => el.id === selectedElementIds[0]) || null : null}
            onColorChange={handlePropertyColorChange}
            onFontChange={handleFontChange}
            onSizeChange={handleSizeChange}
            onWeightChange={handleWeightChange}
            onLetterSpacingChange={handleLetterSpacingChange}
            onLineHeightChange={handleLineHeightChange}
            onAlignChange={handleAlignChange}
            onOpacityChange={handleOpacityChange}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onFillEnabledChange={handleFillEnabledChange}
            onStrokeChange={handleStrokeChange}
            onStrokeWidthChange={handleStrokeWidthChange}
            onStrokeEnabledChange={handleStrokeEnabledChange}
            onShadowEnabledChange={handleShadowEnabledChange}
            onShadowColorChange={handleShadowColorChange}
            onShadowBlurChange={handleShadowBlurChange}
            onShadowOffsetXChange={handleShadowOffsetXChange}
            onShadowOffsetYChange={handleShadowOffsetYChange}
            onShadowOpacityChange={handleShadowOpacityChange}
            onImageBlurChange={handleImageBlurChange}
            onGenerateShadow={handleGenerateShadow}
            isGeneratingShadow={isGeneratingShadow}
            onFitToCanvas={handleFitToCanvas}
            selectedCount={selectedElementIds.length}
            onCenterHorizontal={handleCenterHorizontal}
            onCenterVertical={handleCenterVertical}
            isMobile={true}
            onClose={() => handleSelectElement([])}
            onDelete={handleDelete}
          />
        )}
      </div>

      <BottomBar
        zoom={safeZoom}
        onZoomChange={handleZoomChange}
        onResetView={resetView}
        onExport={handleExport}
        saveStatus={saveStatus}
        lastSaveError={lastSaveError}
        onRetry={handleSave}
      />

      {/* Guest-only notice: download is fine, saving needs login */}
      <GuestEditorNoticeModal
        isOpen={showGuestNotice}
        onConfirm={handleGuestNoticeConfirm}
        title={t('banner:guestNoticeTitle')}
        message={t('banner:guestNoticeMessage')}
        confirmLabel={t('banner:guestNoticeConfirm')}
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false);
          navigate(editorReturnTo);
        }}
      />

      {/* Desktop Recommended Modal (mobile only) */}
      <DesktopRecommendedModal
        isOpen={showDesktopModal}
        onClose={() => setShowDesktopModal(false)}
      />

      <SaveAsTemplateModal
        isOpen={showSaveAsTemplateModal}
        onClose={() => setShowSaveAsTemplateModal(false)}
        onSave={handleTemplateModalSave}
        defaultName={banner.name}
      />

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
    </div>
  );
}
