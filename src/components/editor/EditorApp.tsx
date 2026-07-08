'use client';

// Editor island entry (docs/archive/CONSOLIDATION_PLAN.md M1).
//
// Everything the ported IMAGINE editor needs at runtime is closed inside this
// client-only boundary: react-query provider, react-i18next initialization
// (side-effect import of ./i18n) and the Google Fonts / Material Symbols
// stylesheets the canvas fonts and icon glyphs depend on.
//
// The island renders as a full-viewport overlay (above the Gallery header,
// z-50, and its mobile menu, z-[60]) because the editor brings its own
// header/toolbar chrome and uses h-screen layouts.

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useEditorFonts } from './lib/fonts';
import { BannerEditor } from './pages/BannerEditor';
import './i18n';

export function EditorApp() {
  useEditorFonts();

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-white">
      <QueryClientProvider client={queryClient}>
        <BannerEditor />
      </QueryClientProvider>
    </div>
  );
}
