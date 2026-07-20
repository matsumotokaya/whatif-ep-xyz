'use client';

// My Designs island entry (docs/archive/CONSOLIDATION_PLAN.md M4, brought forward).
//
// Lightweight sibling of EditorApp for the /mydesign list pages: it reuses the
// same client-only providers (react-query, react-i18next side-effect init,
// Google Fonts / Material Symbols) but does not pull in the Konva canvas
// editor, so the /mydesign chunk stays small.
//
// Rendered as a full-viewport overlay above the Gallery chrome (same z-[70]
// layer as the editor island) because the ported IMAGINE pages bring their own
// header. The overlay owns its scrolling; the page behind it stays empty.

import { EditorQueryProvider } from './EditorQueryProvider';
import { useEditorFonts } from './lib/fonts';
import { useParams } from './lib/router';
import { BannerManager } from './pages/BannerManager';
import { BannersBySize } from './pages/BannersBySize';
import './i18n';

export function MyDesignsApp() {
  useEditorFonts();
  const { sizeKey } = useParams<{ sizeKey: string }>();

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#101010]">
      <EditorQueryProvider>
        {sizeKey ? <BannersBySize /> : <BannerManager />}
      </EditorQueryProvider>
    </div>
  );
}
