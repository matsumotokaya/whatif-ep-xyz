import { type ReactNode } from 'react';

// Shared Stories bottom-sheet overlay (E3).
//
// A lightweight dimmed modal anchored to the bottom of the screen, matching the
// dark-overlay aesthetic of StoriesTextEditor (E2-c). Used by the background and
// effects tools. Purely presentational: it renders a backdrop (tap to dismiss),
// a titled header with a close button, and a scrollable content area sized for
// thumb interaction. State lives in BannerEditor; this is just chrome.
interface StoriesSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export const StoriesSheet = ({ title, onClose, children }: StoriesSheetProps) => {
  return (
    <div className="fixed inset-0 z-[90]">
      {/* Backdrop: tap outside the panel dismisses */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-white/10 bg-[#1a1a1a] shadow-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
      </div>
    </div>
  );
};
