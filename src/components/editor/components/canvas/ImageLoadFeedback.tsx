import { useTranslation } from 'react-i18next';
import { resolveElementSrc } from '@/lib/asset';
import { useEditorImage } from '../../hooks/useEditorImage';
import type { CanvasElement, ImageElement } from '../../types/template';
import { BLEED } from '../../utils/canvasGeometry';

function ImageStatus({ element, index }: { element: ImageElement; index: number }) {
  const { t } = useTranslation('common');
  const { status, retry } = useEditorImage(resolveElementSrc(element.src));
  if (status === 'loaded') return null;
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-md bg-[#202020] px-3 py-2 text-xs text-white shadow-sm" data-image-state={status}>
      <span aria-hidden="true" className="material-symbols-outlined text-base">
        {status === 'error' ? 'broken_image' : 'hourglass_top'}
      </span>
      <span>{t('imageLoad.image', { index })}: {t(`imageLoad.${status}`)}</span>
      {status === 'error' && (
        <button type="button" onClick={retry} className="rounded border border-gray-500 px-2 py-1 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
          aria-label={t('imageLoad.retryImage', { index })}>
          {t('imageLoad.retry')}
        </button>
      )}
    </div>
  );
}

// DOM feedback stays out of canvas exports and survives the entrance animation.
// Mounting here also starts image requests while the lazy canvas chunk loads.
export function ImageLoadFeedback({ elements, scale, width, height }: {
  elements: CanvasElement[]; scale: number; width: number; height: number;
}) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true"
      className="pointer-events-none absolute z-20 flex flex-col items-start gap-1 overflow-y-auto p-2"
      style={{ left: BLEED * scale, top: BLEED * scale, maxWidth: width * scale, maxHeight: height * scale }}>
      {elements.filter((el): el is ImageElement => el.type === 'image' && (el.visible ?? true))
        .map((element, index) => <ImageStatus key={element.id} element={element} index={index + 1} />)}
    </div>
  );
}
