import type { CanvasElement } from '../types/template';

// Element clipboard for copy / cut / paste.
//
// Copied elements are kept in memory and mirrored to localStorage so a paste
// works in another tab or another design. The system clipboard only carries a
// marker identifying that copy: on paste, the marker tells us whether the
// user's most recent copy was ours or something else (an image, plain text),
// which is what decides what a paste should produce.

const STORAGE_KEY = 'whatif_clipboard';
const MARKER_ATTRIBUTE = 'data-whatif-clipboard';
const MARKER_PATTERN = /data-whatif-clipboard="([A-Za-z0-9-]+)"/;

export interface ClipboardPayload {
  token: string;
  elements: CanvasElement[];
  // Whether the system clipboard was successfully tagged with `token`.
  markedOnSystem: boolean;
}

let memory: ClipboardPayload | null = null;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Text a paste into another application should receive: the copied text
// elements, one per line.
export function clipboardPlainText(elements: CanvasElement[]): string {
  return elements
    .filter((element) => element.type === 'text')
    .map((element) => (element.type === 'text' ? element.text : ''))
    .join('\n');
}

export function clipboardMarkerHtml(token: string, plainText: string): string {
  return `<span ${MARKER_ATTRIBUTE}="${token}">${escapeHtml(plainText)}</span>`;
}

export function readClipboardToken(html: string | null | undefined): string | null {
  if (!html) return null;
  return MARKER_PATTERN.exec(html)?.[1] ?? null;
}

export type PasteSource =
  | { kind: 'elements' }
  | { kind: 'images'; files: File[] }
  | { kind: 'text'; text: string }
  | { kind: 'none' };

export interface PasteInput {
  html: string;
  text: string;
  imageFiles: File[];
  internal: Pick<ClipboardPayload, 'token' | 'markedOnSystem'> | null;
}

// Decide what a paste should produce.
export function resolvePasteSource({ html, text, imageFiles, internal }: PasteInput): PasteSource {
  // The system clipboard could not be tagged when the elements were copied,
  // so it cannot tell us whether something newer replaced them. Trust the
  // element copy the user made here.
  if (internal && !internal.markedOnSystem) return { kind: 'elements' };
  if (imageFiles.length > 0) return { kind: 'images', files: imageFiles };
  if (internal && readClipboardToken(html) === internal.token) return { kind: 'elements' };
  if (text.trim() !== '') return { kind: 'text', text };
  if (internal) return { kind: 'elements' };
  return { kind: 'none' };
}

function readStored(): ClipboardPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Earlier versions stored a bare element or a bare array of elements.
    if (Array.isArray(parsed)) {
      return { token: 'legacy', elements: parsed as CanvasElement[], markedOnSystem: false };
    }
    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as Partial<ClipboardPayload> & Partial<CanvasElement>;
      if (Array.isArray(candidate.elements) && typeof candidate.token === 'string') {
        return {
          token: candidate.token,
          elements: candidate.elements,
          markedOnSystem: candidate.markedOnSystem === true,
        };
      }
      if (typeof candidate.id === 'string' && typeof candidate.type === 'string') {
        return { token: 'legacy', elements: [parsed as CanvasElement], markedOnSystem: false };
      }
    }
  } catch {
    // Unreadable or unavailable storage simply means nothing to paste.
  }
  return null;
}

function persist(payload: ClipboardPayload): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be full or disabled; the in-memory copy still works here.
  }
}

// The current element copy. Another tab may have copied more recently, so the
// stored value wins whenever it carries a different token.
export function readElementClipboard(): ClipboardPayload | null {
  const stored = readStored();
  if (stored && stored.token !== memory?.token) {
    memory = stored;
  }
  return memory;
}

// Remember `elements` as the current copy and tag the system clipboard.
export function writeElementClipboard(elements: CanvasElement[]): void {
  if (elements.length === 0) return;

  const payload: ClipboardPayload = {
    token: crypto.randomUUID(),
    elements: elements.map((element) => ({ ...element })),
    markedOnSystem: false,
  };
  memory = payload;
  persist(payload);

  const plainText = clipboardPlainText(elements);
  const canWriteRich = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  if (!canWriteRich) return;

  void navigator.clipboard
    .write([
      new ClipboardItem({
        'text/html': new Blob([clipboardMarkerHtml(payload.token, plainText)], { type: 'text/html' }),
        'text/plain': new Blob([plainText || ' '], { type: 'text/plain' }),
      }),
    ])
    .then(() => {
      // Only confirm the copy that is still current.
      if (memory?.token !== payload.token) return;
      memory = { ...payload, markedOnSystem: true };
      persist(memory);
    })
    .catch(() => {
      // Permission denied or unsupported: paste falls back to the element copy.
    });
}
