import type { Banner, CanvasElement, ShapeElement, TextElement } from '../types/template';
import { resolveElementSrc } from '@/lib/asset';

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_QUALITY = 0.7;
const FULLRES_QUALITY = 0.88;

export interface RenderedBannerPreviewAssets {
  thumbnailDataURL: string;
  fullresDataURL: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load a banner image for preview rendering.`));
    image.src = src;
  });
}

function textFontStyle(element: TextElement): 'bold' | 'lighter' | 'normal' {
  if (element.fontWeight >= 700) return 'bold';
  if (element.fontWeight <= 300) return 'lighter';
  return 'normal';
}

async function ensureTextFonts(elements: CanvasElement[]): Promise<void> {
  if (!('fonts' in document)) return;

  const fontSpecs = new Set(
    elements
      .filter((element): element is TextElement => element.type === 'text')
      .map((element) => `${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`),
  );

  await Promise.allSettled([...fontSpecs].map((font) => document.fonts.load(font)));
  await document.fonts.ready;
}

function shapeCommonProps(shape: ShapeElement) {
  return {
    fill: shape.fillEnabled ? shape.fill : undefined,
    stroke: shape.strokeEnabled ? shape.stroke : undefined,
    strokeWidth: shape.strokeEnabled ? shape.strokeWidth : 0,
    shadowEnabled: shape.shadowEnabled ?? false,
    shadowColor: shape.shadowColor ?? '#000000',
    shadowBlur: shape.shadowBlur ?? 4,
    shadowOffsetX: shape.shadowOffsetX ?? 2,
    shadowOffsetY: shape.shadowOffsetY ?? 2,
    shadowOpacity: shape.shadowOpacity ?? 0.5,
    rotation: shape.rotation ?? 0,
    opacity: shape.opacity ?? 1,
    visible: shape.visible ?? true,
    listening: false,
  };
}

// Render a banner without mounting the interactive editor. This is used for
// Content Factory's freshly-created drafts so their list thumbnail and
// Publish source preview exist before anybody opens the detail screen.
export async function renderBannerPreviewAssets(
  banner: Pick<Banner, 'template' | 'elements' | 'canvasColor'>,
): Promise<RenderedBannerPreviewAssets> {
  const { default: Konva } = await import('konva');
  const { width, height } = banner.template;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('The banner has invalid canvas dimensions.');
  }

  const imageEntries = await Promise.all(
    banner.elements
      .filter((element) => element.type === 'image')
      .map(async (element) => {
        const src = resolveElementSrc(element.src);
        if (!src) throw new Error('A banner image has no source.');
        return [element.id, await loadImage(src)] as const;
      }),
  );
  const images = new Map(imageEntries);
  await ensureTextFonts(banner.elements);

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.left = '-100000px';
  container.style.top = '0';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const stage = new Konva.Stage({ container, width, height });
  try {
    const layer = new Konva.Layer({ listening: false });
    const artboard = new Konva.Group({
      clipX: 0,
      clipY: 0,
      clipWidth: width,
      clipHeight: height,
      listening: false,
    });
    layer.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: banner.canvasColor, listening: false }));
    layer.add(artboard);
    stage.add(layer);

    for (const element of banner.elements) {
      if (element.type === 'image') {
        const image = images.get(element.id);
        if (!image) throw new Error('A banner image was not available for preview rendering.');
        const node = new Konva.Image({
          image,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          shadowEnabled: element.shadowEnabled ?? false,
          shadowColor: element.shadowColor ?? '#000000',
          shadowBlur: element.shadowBlur ?? 4,
          shadowOffsetX: element.shadowOffsetX ?? 2,
          shadowOffsetY: element.shadowOffsetY ?? 2,
          shadowOpacity: element.shadowOpacity ?? 0.5,
          rotation: element.rotation ?? 0,
          opacity: element.opacity ?? 1,
          visible: element.visible ?? true,
          listening: false,
        });
        if ((element.blurRadius ?? 0) > 0) {
          node.filters([Konva.Filters.Blur]);
          node.blurRadius(element.blurRadius ?? 0);
          node.cache({ offset: Math.max(16, Math.ceil((element.blurRadius ?? 0) * 2)) });
        }
        artboard.add(node);
        continue;
      }

      if (element.type === 'text') {
        artboard.add(new Konva.Text({
          text: element.text,
          x: element.x,
          y: element.y,
          fontSize: element.fontSize,
          fontFamily: element.fontFamily,
          letterSpacing: element.letterSpacing ?? 0,
          lineHeight: element.lineHeight ?? 1,
          align: element.align ?? 'left',
          fontStyle: textFontStyle(element),
          fill: element.fillEnabled ? element.fill : 'transparent',
          stroke: element.strokeEnabled ? element.stroke : undefined,
          strokeWidth: element.strokeEnabled ? element.strokeWidth : 0,
          shadowEnabled: element.shadowEnabled ?? false,
          shadowColor: element.shadowColor ?? '#000000',
          shadowBlur: element.shadowBlur ?? 4,
          shadowOffsetX: element.shadowOffsetX ?? 2,
          shadowOffsetY: element.shadowOffsetY ?? 2,
          shadowOpacity: element.shadowOpacity ?? 0.5,
          rotation: element.rotation ?? 0,
          opacity: element.opacity ?? 1,
          visible: element.visible ?? true,
          listening: false,
        }));
        continue;
      }

      const shape = element;
      const safeWidth = Number.isFinite(shape.width) ? shape.width : 200;
      const safeHeight = Number.isFinite(shape.height) ? shape.height : 150;
      const common = shapeCommonProps(shape);
      if (shape.shapeType === 'rectangle') {
        artboard.add(new Konva.Rect({ ...common, x: shape.x, y: shape.y, width: safeWidth, height: safeHeight }));
      } else if (shape.shapeType === 'triangle') {
        artboard.add(new Konva.Line({
          ...common,
          x: shape.x,
          y: shape.y,
          points: [safeWidth / 2, 0, safeWidth, safeHeight, 0, safeHeight],
          closed: true,
        }));
      } else if (shape.shapeType === 'star') {
        artboard.add(new Konva.Star({
          ...common,
          x: shape.x + safeWidth / 2,
          y: shape.y + safeHeight / 2,
          numPoints: 5,
          innerRadius: Math.min(safeWidth, safeHeight) / 4,
          outerRadius: Math.min(safeWidth, safeHeight) / 2,
        }));
      } else if (shape.shapeType === 'circle') {
        artboard.add(new Konva.Ellipse({
          ...common,
          x: shape.x + safeWidth / 2,
          y: shape.y + safeHeight / 2,
          radiusX: safeWidth / 2,
          radiusY: safeHeight / 2,
        }));
      } else {
        const heartPath = `M ${safeWidth / 2} ${safeHeight * 0.3}
          C ${safeWidth / 2} ${safeHeight * 0.15}, ${safeWidth * 0.35} 0, ${safeWidth * 0.25} 0
          C ${safeWidth * 0.1} 0, 0 ${safeHeight * 0.15}, 0 ${safeHeight * 0.3}
          C 0 ${safeHeight * 0.55}, ${safeWidth / 2} ${safeHeight * 0.8}, ${safeWidth / 2} ${safeHeight}
          C ${safeWidth / 2} ${safeHeight * 0.8}, ${safeWidth} ${safeHeight * 0.55}, ${safeWidth} ${safeHeight * 0.3}
          C ${safeWidth} ${safeHeight * 0.15}, ${safeWidth * 0.9} 0, ${safeWidth * 0.75} 0
          C ${safeWidth * 0.65} 0, ${safeWidth / 2} ${safeHeight * 0.15}, ${safeWidth / 2} ${safeHeight * 0.3} Z`;
        artboard.add(new Konva.Path({ ...common, x: shape.x, y: shape.y, data: heartPath }));
      }
    }

    layer.draw();
    const fullresDataURL = stage.toDataURL({
      x: 0,
      y: 0,
      width,
      height,
      pixelRatio: 1,
      mimeType: 'image/jpeg',
      quality: FULLRES_QUALITY,
    });
    const thumbnailDataURL = stage.toDataURL({
      x: 0,
      y: 0,
      width,
      height,
      pixelRatio: THUMBNAIL_WIDTH / width,
      mimeType: 'image/jpeg',
      quality: THUMBNAIL_QUALITY,
    });

    if (thumbnailDataURL.length < 100 || fullresDataURL.length < 100) {
      throw new Error('The banner preview renderer returned an empty image.');
    }
    return { thumbnailDataURL, fullresDataURL };
  } finally {
    stage.destroy();
    container.remove();
  }
}
