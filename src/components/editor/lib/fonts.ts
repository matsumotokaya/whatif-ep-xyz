'use client';

// Shared runtime font loading for the editor islands (EditorApp and
// MyDesignsApp). Same font set as IMAGINE's index.html: the editor canvas
// (Konva) and the FontSelector offer these families; Material Symbols renders
// the tool/action icons.
// TODO(M4): move font loading to the route layout (e.g. next/font or <head>
// links scoped to /edit and /mydesign) instead of runtime injection.

import { useEffect } from 'react';

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

export function useEditorFonts() {
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
