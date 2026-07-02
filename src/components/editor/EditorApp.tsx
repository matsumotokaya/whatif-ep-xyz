'use client';

// Editor island entry (docs/CONSOLIDATION_PLAN.md M1).
//
// Everything the ported IMAGINE editor needs at runtime is closed inside this
// client-only boundary: react-query provider, react-i18next initialization
// (side-effect import of ./i18n) and the Google Fonts / Material Symbols
// stylesheets the canvas fonts and icon glyphs depend on.
//
// The island renders as a full-viewport overlay (above the Gallery header,
// z-50, and its mobile menu, z-[60]) because the editor brings its own
// header/toolbar chrome and uses h-screen layouts.

import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { BannerEditor } from './pages/BannerEditor';
import './i18n';

// Same font set as IMAGINE's index.html. The editor canvas (Konva) and the
// FontSelector offer these families; Material Symbols renders the tool icons.
// TODO(M4): move font loading to the route layout (e.g. next/font or <head>
// links scoped to /edit) instead of runtime injection.
const FONT_STYLESHEETS: Array<{ id: string; href: string }> = [
  {
    id: 'editor-google-fonts',
    href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100;200;300;400;500;600;700;800;900&family=Noto+Serif+JP:wght@200;300;400;500;600;700;900&family=Bebas+Neue&family=WDXL+Lubrifont+JP+N&family=DotGothic16&family=Anton+SC&family=Bytesized&family=Josefin+Sans:ital,wght@0,100..700;1,100..700&family=Six+Caps&family=Special+Gothic+Expanded+One&display=swap',
  },
  {
    id: 'editor-material-symbols',
    href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  },
];

function useEditorFonts() {
  useEffect(() => {
    for (const { id, href } of FONT_STYLESHEETS) {
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
    // Intentionally left in place on unmount: fonts stay cached for the next
    // editor visit and are harmless elsewhere.
  }, []);
}

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
