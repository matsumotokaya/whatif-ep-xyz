import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { ViewportStore } from '../utils/viewportStore';
import { MAX_VIEW_SCALE, MIN_VIEW_SCALE, scaleToSliderValue, sliderValueToScale } from '../utils/viewportMath';

interface BottomBarProps {
  viewportStore: ViewportStore;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus?: 'saved' | 'saving' | 'unsaved' | 'error';
  onRetry?: () => void;
}

// The slider works in thousandths of its (logarithmic) track.
const SLIDER_STEPS = 1000;

export const BottomBar = ({
  viewportStore,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saveStatus = 'saved',
  onRetry,
}: BottomBarProps) => {
  const { t } = useTranslation(['editor', 'common']);
  // Subscribes here so that zooming re-renders this bar, not the whole editor.
  const getScale = () => viewportStore.getState().view.scale;
  const scale = useSyncExternalStore(viewportStore.subscribe, getScale, getScale);

  const historyButtonClass =
    'size-8 flex items-center justify-center rounded transition-colors text-gray-400 hover:bg-[#333333] disabled:opacity-35 disabled:hover:bg-transparent';

  return (
    <div className="bg-[#1a1a1a] border-t border-[#2b2b2b] overflow-x-auto overflow-y-hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-3 md:px-6 h-14 md:h-16 min-w-max">
        <div className="flex items-center gap-2 md:gap-4">
          {/* Undo / redo - desktop (the mobile layout has its own floating button) */}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={historyButtonClass}
              title={t('editor:history.undo')}
              aria-label={t('editor:history.undo')}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">undo</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={historyButtonClass}
              title={t('editor:history.redo')}
              aria-label={t('editor:history.redo')}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">redo</span>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1.5 md:gap-3">
            <button
              onClick={() => viewportStore.zoomStep(-1)}
              disabled={scale <= MIN_VIEW_SCALE}
              className="size-7 md:size-8 flex items-center justify-center hover:bg-[#333333] rounded transition-colors flex-shrink-0 disabled:opacity-35"
              aria-label="Zoom out"
            >
              <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>

            {/* Range slider - desktop only */}
            <input
              type="range"
              min={0}
              max={SLIDER_STEPS}
              value={Math.round(scaleToSliderValue(scale) * SLIDER_STEPS)}
              onChange={(e) => viewportStore.zoomTo(sliderValueToScale(Number(e.target.value) / SLIDER_STEPS))}
              className="hidden md:block w-24 md:w-32 h-1 bg-[#444444] rounded-lg appearance-none cursor-pointer accent-indigo-500"
              aria-label="Canvas zoom"
              aria-valuetext={`${Math.round(scale * 100)}%`}
            />

            <button
              onClick={() => viewportStore.zoomStep(1)}
              disabled={scale >= MAX_VIEW_SCALE}
              className="size-7 md:size-8 flex items-center justify-center hover:bg-[#333333] rounded transition-colors flex-shrink-0 disabled:opacity-35"
              aria-label="Zoom in"
            >
              <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>

            <span className="text-xs md:text-sm text-gray-400 font-medium min-w-[2.5rem] md:min-w-[3rem] text-center tabular-nums">
              {Math.round(scale * 100)}%
            </span>
          </div>

          <button
            onClick={() => viewportStore.fit()}
            className="px-2 py-1 text-xs md:text-sm text-gray-400 hover:bg-[#333333] rounded transition-colors flex-shrink-0"
            title="Fit canvas to screen"
            aria-label="Fit canvas to screen"
          >
            Fit
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3 md:gap-4">
          {/* Save status */}
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">{t('editor:save.saving')}</span>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-2 text-green-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">{t('editor:save.saved')}</span>
            </div>
          )}
          {saveStatus === 'unsaved' && (
            <div className="flex items-center gap-2 text-orange-400">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="2" />
              </svg>
              <span className="text-sm">{t('editor:save.unsaved')}</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm">{t('editor:save.error')}</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-xs underline hover:no-underline ml-2 text-red-300"
                >
                  {t('editor:save.retry')}
                </button>
              )}
            </div>
          )}

          {/* Download button */}
          <button
            onClick={onExport}
            className="px-4 md:px-6 py-2 md:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all font-medium text-xs md:text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">download</span>
            <span className="hidden sm:inline">{t('editor:download')}</span>
            <span className="sm:hidden">DL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
