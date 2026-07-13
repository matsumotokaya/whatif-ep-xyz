import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { computeFitScale } from './fitScale';

// Stories mode shell (E2-a): the mobile-dedicated editor view.
//
// Responsibilities: fixed top bar (close / undo / done), fit-to-screen canvas
// area (no user zoom or pan), selection chips (delete, bring to front, send
// to back) and the bottom "add" toolbar. All document state and mutations
// stay in BannerEditor and flow through the command layer — this component is
// pure chrome around the shared Canvas, which is injected via `renderCanvas`
// so the Konva Stage remains single-mounted and owned by BannerEditor.

interface StoriesShellProps {
  canvasWidth: number;
  canvasHeight: number;
  // Receives the fit-to-screen scale and returns the shared editor canvas.
  renderCanvas: (scale: number) => ReactNode;
  // Saves (autosave is always on) and returns to the design list.
  onClose: () => void;
  onUndo: () => void;
  canUndo: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  hasSelection: boolean;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onClearSelection: () => void;
  // Drag-to-trash (E2-b): while an element is being dragged the shell swaps
  // the selection chips for a trash drop zone. Canvas hit-tests the pointer
  // against `trashRef` and reports hover via `isOverTrash`.
  isDraggingElement: boolean;
  isOverTrash: boolean;
  trashRef: RefObject<HTMLDivElement | null>;
  // Fullscreen text editor (E2-c): "Aa" opens an empty editing session; while
  // the overlay is open the shell chrome is hidden (visibility, not display,
  // so the canvas area keeps its size and the fit scale stays stable).
  onAddText: () => void;
  isTextEditing: boolean;
  // Add-tools wired in E3: stamps (image library), background (canvas color),
  // effects (opacity/blur/shadow on the selected element). Effects are only
  // available when a single unlocked element is selected; otherwise the button
  // is disabled.
  onOpenStamps: () => void;
  onOpenBackground: () => void;
  onOpenEffects: () => void;
  canApplyEffects: boolean;
}

// Padding kept around the artboard inside the canvas area (CSS px).
const CANVAS_AREA_PADDING = 16;

export const StoriesShell = ({
  canvasWidth,
  canvasHeight,
  renderCanvas,
  onClose,
  onUndo,
  canUndo,
  saveStatus,
  hasSelection,
  onDelete,
  onBringToFront,
  onSendToBack,
  onClearSelection,
  isDraggingElement,
  isOverTrash,
  trashRef,
  onAddText,
  isTextEditing,
  onOpenStamps,
  onOpenBackground,
  onOpenEffects,
  canApplyEffects,
}: StoriesShellProps) => {
  const { t } = useTranslation('editor');
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState<number | null>(null);

  // Keep the artboard fitted to the available area (orientation changes,
  // browser chrome show/hide, DevTools viewport resize).
  useLayoutEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;

    const updateScale = () => {
      const rect = area.getBoundingClientRect();
      setFitScale(
        computeFitScale({
          containerWidth: rect.width,
          containerHeight: rect.height,
          canvasWidth,
          canvasHeight,
          padding: CANVAS_AREA_PADDING,
        })
      );
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(area);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#151515]">
      {/* Top bar: "save & exit" (left) and undo (right). There is deliberately
          no separate "done" button here — autosave is always on, so the single
          labeled exit action doubles as save, and a generic "Done" would clash
          with the per-mode Done buttons (text editor, effect sheet). Hidden
          (not removed) while the fullscreen text editor is open so the layout
          does not shift */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${isTextEditing ? 'invisible' : ''}`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={saveStatus === 'saving'}
          className="flex h-10 items-center gap-1.5 rounded-full bg-black/40 pl-3 pr-4 text-sm font-medium text-white backdrop-blur-sm transition-transform active:scale-95 disabled:opacity-70"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          {saveStatus === 'saving' ? t('save.saving') : t('stories.saveAndExit')}
        </button>

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-transform active:scale-95 disabled:opacity-40"
          aria-label="Undo"
        >
          <span className="material-symbols-outlined text-[22px]">undo</span>
        </button>
      </div>

      {/* Fit-to-screen canvas area: no zoom, no pan */}
      <div
        ref={canvasAreaRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        style={{ touchAction: 'none' }}
        onClick={(event) => {
          // Taps outside the Konva canvas clear the selection (taps on the
          // stage background are handled inside Canvas itself).
          const target = event.target as HTMLElement;
          if (target.tagName !== 'CANVAS') {
            onClearSelection();
          }
        }}
      >
        {fitScale !== null && renderCanvas(fitScale)}

        {/* Trash drop zone: shown while an element is being dragged */}
        {isDraggingElement && (
          <div
            ref={trashRef}
            className={`absolute bottom-4 left-1/2 z-40 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-150 ${
              isOverTrash
                ? 'scale-125 border-red-400 bg-red-500/90 text-white'
                : 'border-white/40 bg-black/50 text-white/90'
            }`}
            aria-hidden="true"
          >
            <span className={`material-symbols-outlined ${isOverTrash ? 'text-[28px]' : 'text-[24px]'}`}>
              delete
            </span>
          </div>
        )}

        {/* Selection chips: only visible while an element is selected */}
        {hasSelection && !isDraggingElement && !isTextEditing && (
          <div
            className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onSendToBack}
              className="flex h-9 items-center gap-1 rounded-full bg-black/60 px-3 text-xs font-medium text-white backdrop-blur-sm transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">flip_to_back</span>
              {t('properties.sendToBack')}
            </button>
            <button
              type="button"
              onClick={onBringToFront}
              className="flex h-9 items-center gap-1 rounded-full bg-black/60 px-3 text-xs font-medium text-white backdrop-blur-sm transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">flip_to_front</span>
              {t('properties.bringToFront')}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/90 text-white backdrop-blur-sm transition-transform active:scale-95"
              aria-label="Delete element"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar: add-tools — all wired as of E3 */}
      <div
        className={`flex items-stretch justify-around border-t border-white/10 bg-[#101010] px-2 pt-2 ${isTextEditing ? 'invisible' : ''}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <button
          type="button"
          onClick={onAddText}
          className="flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-white transition-transform active:scale-90"
        >
          <span className="material-symbols-outlined text-[24px]">text_fields</span>
          <span className="text-[11px] leading-tight">{t('stories.text')}</span>
        </button>
        <button
          type="button"
          onClick={onOpenStamps}
          className="flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-white transition-transform active:scale-90"
        >
          <span className="material-symbols-outlined text-[24px]">image</span>
          <span className="text-[11px] leading-tight">{t('stories.stamps')}</span>
        </button>
        <button
          type="button"
          onClick={onOpenBackground}
          className="flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-white transition-transform active:scale-90"
        >
          <span className="material-symbols-outlined text-[24px]">palette</span>
          <span className="text-[11px] leading-tight">{t('stories.background')}</span>
        </button>
        <button
          type="button"
          onClick={onOpenEffects}
          disabled={!canApplyEffects}
          className="flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-white transition-transform active:scale-90 disabled:text-white/35 disabled:active:scale-100"
        >
          <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
          <span className="text-[11px] leading-tight">{t('stories.effects')}</span>
        </button>
      </div>
    </div>
  );
};
