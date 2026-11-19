import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { dismissEditorToast, getEditorToasts, subscribeEditorToasts } from '../utils/editorToasts';

const getServerToasts = () => [];

// Renders the editor's transient notices above the bottom bar.
export function EditorToasts() {
  const { t } = useTranslation('common');
  const toasts = useSyncExternalStore(subscribeEditorToasts, getEditorToasts, getServerToasts);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[120] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm text-white shadow-lg ${
            toast.tone === 'error' ? 'border-red-500/60 bg-[#3a1d1d]' : 'border-[#444444] bg-[#202020]'
          }`}
        >
          {toast.tone === 'progress' && (
            <span
              aria-hidden="true"
              className="mt-0.5 inline-block size-4 shrink-0 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin"
            />
          )}
          <span className="text-pretty">{toast.message}</span>
          {toast.tone !== 'progress' && (
            <button
              type="button"
              onClick={() => dismissEditorToast(toast.id)}
              aria-label={t('button.close')}
              className="-mr-1 shrink-0 rounded p-0.5 text-white/60 transition-colors hover:text-white"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] leading-none">close</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
