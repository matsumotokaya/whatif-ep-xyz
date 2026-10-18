'use client';

// Headless render surface for scripts/design.mjs (AI-authored drafts).
// It exposes the editor's own document normalizer, size presets and
// off-screen Konva renderer on `window.__whatifDesignBridge`, so a draft made
// outside the editor is previewed by exactly the code the editor and Content
// Factory use. The page holds no credentials and reads no data: the caller
// passes a document in and receives JPEG data URLs back.

import { useEffect, useState } from 'react';
import { useEditorFonts } from './lib/fonts';
import { migrateElements } from './utils/elementMigration';
import { renderBannerPreviewAssets, textFontSpec } from './utils/bannerPreviewRenderer';
import { ALL_SIZE_PRESETS, DEFAULT_SIZES } from './utils/sizeCategories';
import type { CanvasElement, Template, TextElement } from './types/template';

const BRIDGE_VERSION = 1;
const FONT_STYLESHEET_ID = 'editor-google-fonts';

interface BridgeDocument {
  template: Template;
  elements: CanvasElement[];
  canvasColor: string;
}

function whenStylesheetLoaded(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const link = document.getElementById(id) as HTMLLinkElement | null;
      if (link?.sheet) return resolve();
      if (link) {
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener('error', () => reject(new Error('Editor font stylesheet failed to load.')), { once: true });
        return;
      }
      if (Date.now() - started > 10_000) return reject(new Error('Editor font stylesheet was not injected.'));
      window.setTimeout(poll, 50);
    };
    poll();
  });
}

function listPresets() {
  const byKey = new Map<string, { key: string; label: string; group: string; width: number; height: number }>();
  for (const size of DEFAULT_SIZES) byKey.set(size.key, { ...size, group: 'default' });
  for (const group of ALL_SIZE_PRESETS) {
    for (const size of group.presets) {
      if (!byKey.has(size.key)) byKey.set(size.key, { ...size, group: group.groupKey });
    }
  }
  return [...byKey.values()];
}

// Fonts the browser could not resolve fall back silently on canvas, so report
// them instead of letting a preview look "ready" with the wrong typeface.
function unresolvedFonts(elements: CanvasElement[]): string[] {
  return [...new Set(
    elements
      .filter((element): element is TextElement => element.type === 'text')
      .filter((element) => !document.fonts.check(textFontSpec(element), element.text || ' '))
      .map(textFontSpec),
  )];
}

export function RenderBridge() {
  useEditorFonts();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    whenStylesheetLoaded(FONT_STYLESHEET_ID)
      .then(() => {
        if (cancelled) return;
        Object.assign(window, {
          __whatifDesignBridge: {
            version: BRIDGE_VERSION,
            presets: listPresets,
            normalize: (elements: CanvasElement[]) => migrateElements(elements),
            render: async (doc: BridgeDocument) => {
              const elements = migrateElements(doc.elements);
              const rendered = await renderBannerPreviewAssets({ ...doc, elements });
              return { ...rendered, unresolvedFonts: unresolvedFonts(elements) };
            },
          },
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main data-bridge-status={status} className="p-6 font-mono text-sm text-neutral-500">
      design render bridge: {status}
    </main>
  );
}
