import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import debounce from 'lodash.debounce';
import type { Banner, CanvasElement, Template } from '../types/template';
import type { CanvasRef } from '../components/Canvas';
import type { DocumentStore } from '../utils/documentStore';
import { SaveQueue } from '../utils/saveQueue';
import { GUEST_STORAGE_KEY } from '../utils/guestDesign';
import { clearEditorRecovery, writeEditorRecovery } from '../utils/editorRecovery';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface SaveRequest {
  generateThumbnail: boolean;
  // Scheduled by the idle timer rather than asked for by the user. A
  // background preview is postponed while the canvas is mid-gesture.
  background: boolean;
}

interface PreviewAssets {
  thumbnailDataURL?: string;
  fullresDataURL?: string;
}

export interface MemberSaveInput extends PreviewAssets {
  elements: CanvasElement[];
  canvasColor: string;
}

export type PersistenceTarget =
  | {
      mode: 'guest';
      // Read at save time so a renamed or resized guest design is stored as it is now.
      getSnapshotMeta: () => { name: string; template: Template; createdAt: string };
    }
  | {
      mode: 'member';
      bannerId: string;
      userId: string | undefined;
      // Latest server row, used to repair a preview left pending or failed.
      getBanner: () => Banner | null | undefined;
      save: (input: MemberSaveInput) => Promise<Banner | null>;
    };

interface UseEditorPersistenceOptions {
  store: DocumentStore;
  canvasRef: RefObject<CanvasRef | null>;
  target: PersistenceTarget;
  // The document already differs from what is stored (recovered snapshot,
  // normalised legacy data, seeded default content) and must be saved now.
  initiallyDirty: boolean;
  // True while a drag or transform is in progress on the canvas.
  isCanvasBusy: () => boolean;
  saveFailedMessage: string;
}

const MEMBER_SAVE_DELAY_MS = 3000;
const GUEST_SAVE_DELAY_MS = 1000;
const IDLE_PREVIEW_DELAY_MS = 10000;
const RECOVERY_SNAPSHOT_DELAY_MS = 200;

// A data URL shorter than this is an empty or failed canvas read.
const MIN_PREVIEW_DATA_URL_LENGTH = 100;

async function generatePreviewAssets(canvas: CanvasRef): Promise<PreviewAssets> {
  await canvas.whenReadyForExport();
  const thumbnail = canvas.exportThumbnail();
  const fullres = canvas.exportFullresPreview();
  return {
    thumbnailDataURL: thumbnail && thumbnail.length >= MIN_PREVIEW_DATA_URL_LENGTH ? thumbnail : undefined,
    fullresDataURL: fullres && fullres.length >= MIN_PREVIEW_DATA_URL_LENGTH ? fullres : undefined,
  };
}

// Autosave pipeline for one open document: a serialized save queue fed by
// debounced timers, a synchronous local recovery snapshot, and the flush used
// by explicit saves and by leaving the editor.
export function useEditorPersistence(options: UseEditorPersistenceOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(options.initiallyDirty ? 'unsaved' : 'saved');
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);

  // The pipeline outlives individual renders, so it reads its inputs through
  // a ref that always holds the latest options.
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const [pipeline] = useState(() => {
    const { store } = options;
    // Document revision known to be stored. -1 forces the first save.
    let persistedRevision = options.initiallyDirty ? -1 : store.getState().revision;
    // The stored preview images no longer show the document.
    let previewDirty = false;
    // Something stored next to the document changed (a guest design's
    // artboard size) and has not been written yet.
    let settingsDirty = false;

    const writeRecoveryNow = () => {
      const { target } = optionsRef.current;
      if (target.mode !== 'member' || !target.userId) return;
      const state = store.getState();
      writeEditorRecovery({
        userId: target.userId,
        bannerId: target.bannerId,
        elements: state.elements,
        canvasColor: state.canvasColor,
        updatedAt: new Date().toISOString(),
      });
    };

    const recoverySave = debounce(writeRecoveryNow, RECOVERY_SNAPSHOT_DELAY_MS);

    const performSave = async (request: SaveRequest) => {
      const { canvasRef, target, isCanvasBusy, saveFailedMessage } = optionsRef.current;

      let wantsPreview = request.generateThumbnail;
      if (wantsPreview && request.background && isCanvasBusy()) {
        // Mid-gesture the canvas shows a state the document does not have
        // yet. Save the document now and try the preview again later.
        wantsPreview = false;
        idlePreviewSave();
      }

      setSaveStatus('saving');
      setLastSaveError(null);

      try {
        const assets: PreviewAssets =
          wantsPreview && canvasRef.current ? await generatePreviewAssets(canvasRef.current) : {};
        const hasAssets = Boolean(assets.thumbnailDataURL || assets.fullresDataURL);

        // Read the document after the preview was captured, so both describe
        // the same state even if an edit landed while fonts were loading.
        const state = store.getState();
        const savedRevision = state.revision;

        if (target.mode === 'guest') {
          const meta = target.getSnapshotMeta();
          settingsDirty = false;
          localStorage.setItem(
            GUEST_STORAGE_KEY,
            JSON.stringify({
              name: meta.name,
              template: meta.template,
              elements: state.elements,
              canvasColor: state.canvasColor,
              updatedAt: new Date().toISOString(),
              createdAt: meta.createdAt,
              thumbnailUrl: assets.thumbnailDataURL,
              fullresUrl: assets.fullresDataURL,
            }),
          );
          const hasNewerChanges = store.getState().revision !== savedRevision;
          if (!hasNewerChanges) persistedRevision = savedRevision;
          if (wantsPreview && hasAssets) previewDirty = false;
          setSaveStatus(hasNewerChanges ? 'unsaved' : 'saved');
          return;
        }

        const result = await target.save({
          elements: state.elements,
          canvasColor: state.canvasColor,
          ...assets,
        });
        if (!result) {
          throw new Error(saveFailedMessage);
        }

        const hasNewerChanges = store.getState().revision !== savedRevision;
        if (hasNewerChanges) {
          setSaveStatus('unsaved');
          return;
        }

        persistedRevision = savedRevision;
        recoverySave.cancel();
        if (target.userId) clearEditorRecovery(target.userId, target.bannerId);
        if (wantsPreview && hasAssets && result.previewStatus === 'ready') {
          previewDirty = false;
        }
        setSaveStatus('saved');
      } catch (error) {
        console.error('[editor] Save failed:', error);
        setSaveStatus('error');
        setLastSaveError(error instanceof Error ? error.message : saveFailedMessage);
        throw error;
      }
    };

    const queue = new SaveQueue<SaveRequest>({
      execute: performSave,
      merge: (previous, incoming) => ({
        generateThumbnail: previous.generateThumbnail || incoming.generateThumbnail,
        // One explicit request makes the merged save explicit.
        background: previous.background && incoming.background,
      }),
    });

    const enqueueDocumentSave = () => {
      queue.enqueue({ generateThumbnail: false, background: true });
    };

    const debouncedSave = debounce(enqueueDocumentSave, MEMBER_SAVE_DELAY_MS);
    const debouncedGuestSave = debounce(enqueueDocumentSave, GUEST_SAVE_DELAY_MS);
    const idlePreviewSave = debounce(() => {
      if (optionsRef.current.target.mode === 'guest') return;
      queue.enqueue({ generateThumbnail: true, background: true });
    }, IDLE_PREVIEW_DELAY_MS);

    const cancelTimers = () => {
      debouncedSave.cancel();
      debouncedGuestSave.cancel();
      idlePreviewSave.cancel();
    };

    const hasUnsavedDocument = () => settingsDirty || store.getState().revision !== persistedRevision;

    // Run the save pipeline now. `generateThumbnail` is for explicit save and
    // leave actions, so list thumbnails are current before the user exits.
    const flush = async (generateThumbnail: boolean) => {
      const { target } = optionsRef.current;
      const banner = target.mode === 'member' ? target.getBanner() : null;
      // A row left at 'pending' or 'failed' has no other way back to 'ready':
      // a document-only save marks it pending, and the local dirty flag is
      // clean on a fresh open, so without this the stale status is permanent.
      const previewStatusNeedsRepair =
        banner?.previewStatus === 'pending' || banner?.previewStatus === 'failed';
      const previewNeedsRefresh =
        generateThumbnail
        && (previewDirty
          || target.mode === 'guest'
          || previewStatusNeedsRepair
          || (!!banner && (!banner.thumbnailUrl || !banner.fullresUrl)));

      if (!hasUnsavedDocument() && !queue.isBusy && !previewNeedsRefresh) return;

      cancelTimers();
      queue.enqueue({ generateThumbnail, background: false });
      await queue.flush();
    };

    const markDirty = () => {
      previewDirty = true;
      setSaveStatus('unsaved');
      if (optionsRef.current.target.mode === 'guest') {
        debouncedGuestSave();
        return;
      }
      recoverySave();
      debouncedSave();
      idlePreviewSave();
    };

    // Persist a synchronous recovery snapshot before the page can be frozen
    // or discarded. The network save stays best-effort during unload, but
    // recovery does not depend on the browser waiting for a Promise.
    const persistRecoveryNow = () => {
      if (!hasUnsavedDocument()) return;
      recoverySave.cancel();
      writeRecoveryNow();
    };

    const saveOnUnload = () => {
      if (!hasUnsavedDocument()) return;
      persistRecoveryNow();
      cancelTimers();
      queue.enqueue({ generateThumbnail: false, background: false });
      void queue.flush().catch(() => {
        // The synchronous recovery snapshot above is the reliable fallback.
      });
    };

    // A setting saved with the document changed without touching its content.
    const markSettingsDirty = () => {
      settingsDirty = true;
      markDirty();
    };

    return {
      queue,
      flush,
      markDirty,
      markSettingsDirty,
      persistRecoveryNow,
      saveOnUnload,
      enqueueDocumentSave,
      cancelTimers: () => {
        cancelTimers();
        recoverySave.cancel();
      },
    };
  });

  const { store, initiallyDirty } = options;

  // Every content change schedules a save.
  useEffect(() => {
    let seenRevision = store.getState().revision;
    return store.subscribe(() => {
      const { revision } = store.getState();
      // History bookkeeping alone (recording a finished preview) changes no content.
      if (revision === seenRevision) return;
      seenRevision = revision;
      pipeline.markDirty();
    });
  }, [store, pipeline]);

  useEffect(() => {
    if (initiallyDirty) pipeline.enqueueDocumentSave();
  }, [initiallyDirty, pipeline]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pipeline.persistRecoveryNow();
    };

    window.addEventListener('beforeunload', pipeline.saveOnUnload);
    window.addEventListener('pagehide', pipeline.persistRecoveryNow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', pipeline.saveOnUnload);
      window.removeEventListener('pagehide', pipeline.persistRecoveryNow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pipeline]);

  // Leaving without the exit flow (browser back) must not drop a change that
  // was still waiting for its autosave timer.
  useEffect(() => {
    return () => {
      pipeline.saveOnUnload();
      pipeline.cancelTimers();
    };
  }, [pipeline]);

  return {
    saveStatus,
    lastSaveError,
    // Save now and wait for it; rejects if the save failed.
    flush: pipeline.flush,
    // Save the document now without waiting (after adding or removing elements).
    saveSoon: () => {
      void pipeline.flush(false).catch(() => {
        // The failure is already reflected in saveStatus.
      });
    },
    // Schedule a save for a change outside the document content.
    markSettingsDirty: pipeline.markSettingsDirty,
  };
}
