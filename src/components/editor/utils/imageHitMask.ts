// Pixel-accurate hit areas for images with transparency.
//
// Konva hit-tests an image by its rectangle, so the transparent parts of a
// cut-out character still catch clicks and hide every element behind them.
// A hit mask paints only the opaque pixels in the node's hit colour, so a
// click on a transparent area falls through to whatever is underneath, the
// way Canva and Figma behave.
//
// The mask is computed once per decoded image at a reduced resolution; per hit
// colour it is a single tinted copy of that mask.

const MAX_MASK_SIDE = 512;
// Pixels at or below this alpha are treated as empty. Soft edges and faint
// glows around a cut-out should not catch clicks.
const ALPHA_THRESHOLD = 32;

interface MaskEntry {
  mask: HTMLCanvasElement | null; // null: fully opaque or unreadable → use the rectangle
  tinted: Map<string, HTMLCanvasElement>;
}

const masks = new WeakMap<HTMLImageElement, MaskEntry>();

function buildMask(image: HTMLImageElement): HTMLCanvasElement | null {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  if (!naturalWidth || !naturalHeight) return null;
  const scale = Math.min(1, MAX_MASK_SIDE / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);

  let imageData: ImageData;
  try {
    imageData = context.getImageData(0, 0, width, height);
  } catch {
    // A cross-origin image without CORS cannot be read; keep the rectangle.
    return null;
  }
  const data = imageData.data;
  let hasTransparency = false;
  for (let index = 0; index < data.length; index += 4) {
    const opaque = data[index + 3] > ALPHA_THRESHOLD;
    if (!opaque) hasTransparency = true;
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = opaque ? 255 : 0;
  }
  if (!hasTransparency) return null;
  context.putImageData(imageData, 0, 0);
  return canvas;
}

// The image's opaque pixels painted in `colorKey`, or null when the plain
// rectangle is the right hit area.
export function tintedHitMask(image: HTMLImageElement, colorKey: string): HTMLCanvasElement | null {
  let entry = masks.get(image);
  if (!entry) {
    entry = { mask: buildMask(image), tinted: new Map() };
    masks.set(image, entry);
  }
  if (!entry.mask) return null;

  let tinted = entry.tinted.get(colorKey);
  if (!tinted) {
    tinted = document.createElement('canvas');
    tinted.width = entry.mask.width;
    tinted.height = entry.mask.height;
    const context = tinted.getContext('2d');
    if (!context) return null;
    context.drawImage(entry.mask, 0, 0);
    // Keep the mask's (binary) alpha and replace its colour exactly.
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = colorKey;
    context.fillRect(0, 0, tinted.width, tinted.height);
    entry.tinted.set(colorKey, tinted);
  }
  return tinted;
}
