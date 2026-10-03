import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// Key this component by URL so a changed source never inherits a ready state.
export function ImageLibraryThumbnail({ src, name, onSelect, children }: {
  src: string; name: string; onSelect: () => void; children: ReactNode;
}) {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  return (
    <button type="button" className="absolute inset-0 h-full w-full focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2"
      title={name} aria-label={status === 'error' ? `${name}: ${t('imageLoad.retry')}` : name}
      onClick={() => {
        if (status === 'error') { setStatus('loading'); setAttempt(value => value + 1); }
        else onSelect();
      }}>
      {/* Use the stored thumbnail URL directly, with the canvas CORS/cache identity. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={attempt} src={src} alt={name} className="h-full w-full object-contain" loading="lazy" decoding="async" crossOrigin="anonymous"
        onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />
      {children}
      {status !== 'loaded' && (
        <span role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#222] px-2 pb-6 text-xs text-gray-200">
          <span aria-hidden="true" className="material-symbols-outlined text-xl">{status === 'error' ? 'broken_image' : 'hourglass_top'}</span>
          <span>{t(`imageLoad.${status}`)}</span>
          {status === 'error' && <span className="underline">{t('imageLoad.retry')}</span>}
        </span>
      )}
    </button>
  );
}
