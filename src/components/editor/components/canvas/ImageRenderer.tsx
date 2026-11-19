import { useRef, useEffect, memo, useCallback } from 'react';
import Konva from 'konva';
import { useEditorImage } from '../../hooks/useEditorImage';
import { Image as KonvaImage } from 'react-konva';
import type { ImageElement } from '../../types/template';
import { resolveElementSrc } from '@/lib/asset';
import { elementNodeProps, elementShadowProps, type ElementNodeHandlers } from './elementNode';

// Stable identity: react-konva re-applies a filters array whenever it is a new one.
const BLUR_FILTERS = [Konva.Filters.Blur];
const NO_FILTERS: typeof BLUR_FILTERS = [];

interface ImageRendererProps {
  imageElement: ImageElement;
  handlers: ElementNodeHandlers;
  onImageLoad?: (id: string, status: 'loaded' | 'error') => void;
}

const ImageRendererComponent = ({ imageElement, handlers, onImageLoad }: ImageRendererProps) => {
  const { id } = imageElement;
  const localNodeRef = useRef<Konva.Image | null>(null);
  const setNode = useCallback(
    (node: Konva.Image | null) => {
      localNodeRef.current = node;
      handlers.registerNode(id, node);
    },
    [handlers, id],
  );

  const resolvedSrc = resolveElementSrc(imageElement.src);
  const { image, status } = useEditorImage(resolvedSrc);

  useEffect(() => {
    if (status !== 'loading') onImageLoad?.(id, status);
  }, [id, onImageLoad, status]);

  useEffect(() => {
    const node = localNodeRef.current;
    if (!node || !image) {
      return;
    }

    if ((imageElement.blurRadius ?? 0) > 0) {
      node.clearCache();
      node.cache({
        offset: Math.max(16, Math.ceil((imageElement.blurRadius ?? 0) * 2)),
      });
    } else {
      node.clearCache();
    }

    node.getLayer()?.batchDraw();
  }, [image, imageElement.blurRadius, imageElement.width, imageElement.height]);

  return (
    <KonvaImage
      ref={setNode}
      {...elementNodeProps(imageElement, handlers)}
      {...elementShadowProps(imageElement)}
      image={image || undefined}
      filters={(imageElement.blurRadius ?? 0) > 0 ? BLUR_FILTERS : NO_FILTERS}
      blurRadius={imageElement.blurRadius ?? 0}
      x={imageElement.x}
      y={imageElement.y}
      width={imageElement.width}
      height={imageElement.height}
      rotation={imageElement.rotation || 0}
      opacity={imageElement.opacity ?? 1}
    />
  );
};

export const ImageRenderer = memo(ImageRendererComponent);
