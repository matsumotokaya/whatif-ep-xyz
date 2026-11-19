import type { CanvasElement, TextElement } from '../types/template';

// How a text element's font reaches the canvas, shared by the live editor and
// the off-screen preview renderer so both always request the same face.

// How long the live editor waits for web fonts before exporting with whatever
// is available. Past this point the canvas on screen shows the same fallback,
// so the export still matches what the user sees, and saving or downloading
// stays usable when the font host is slow or unreachable.
export const EDITOR_FONT_WAIT_MS = 8000;

// Konva's fontStyle for a stored numeric weight. The mapping is coarse on
// purpose: existing designs were authored against it, and changing it would
// change how they render.
export function konvaFontStyle(fontWeight: number): 'bold' | 'lighter' | 'normal' {
  if (fontWeight >= 700) return 'bold';
  if (fontWeight <= 300) return 'lighter';
  return 'normal';
}

// CSS font shorthand for the face Konva will request for this element.
export function textFontSpec(element: Pick<TextElement, 'fontWeight' | 'fontSize' | 'fontFamily'>): string {
  return `${konvaFontStyle(element.fontWeight)} ${element.fontSize}px ${element.fontFamily}`;
}

export interface FontRequest {
  spec: string;
  text: string;
}

// One request per distinct font spec, carrying every character drawn with it.
// The text matters: web fonts split by unicode-range (every Japanese Google
// Font) only fetch the subsets covering the sample text.
export function collectFontRequests(elements: CanvasElement[]): FontRequest[] {
  const textBySpec = new Map<string, string>();
  for (const element of elements) {
    if (element.type !== 'text') continue;
    const spec = textFontSpec(element);
    textBySpec.set(spec, (textBySpec.get(spec) ?? '') + element.text);
  }
  return [...textBySpec].map(([spec, text]) => ({ spec, text }));
}

// Stable key for "the set of faces and glyphs these elements need".
export function fontRequestsKey(requests: FontRequest[]): string {
  return requests
    .map(({ spec, text }) => `${spec}\u0000${[...new Set(text)].sort().join('')}`)
    .sort()
    .join('\u0001');
}

// Start loading every face the elements need. A canvas only draws with a web
// font that is already loaded, and never repaints by itself once it arrives.
export function requestFonts(requests: FontRequest[]): Promise<unknown> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  return Promise.allSettled(requests.map(({ spec, text }) => document.fonts.load(spec, text || ' ')));
}

// Resolve once the fonts for `elements` are usable. With `timeoutMs`, resolve
// `false` if they are still loading after that long; without it, wait for as
// long as the browser keeps trying.
export async function ensureTextFonts(elements: CanvasElement[], timeoutMs?: number): Promise<boolean> {
  if (typeof document === 'undefined' || !('fonts' in document)) return true;

  const loaded = requestFonts(collectFontRequests(elements))
    .then(() => document.fonts.ready)
    .then(() => true);
  if (timeoutMs === undefined) return loaded;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([loaded, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
