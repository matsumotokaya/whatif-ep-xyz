import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DesktopRecommendedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'imagine_desktop_modal_dismissed';

export const DesktopRecommendedModal = ({ isOpen, onClose }: DesktopRecommendedModalProps) => {
  const { t } = useTranslation('modal');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{t('desktopRecommended.title')}</h2>
          <p className="text-white/90 text-sm leading-relaxed">{t('desktopRecommended.description')}</p>
        </div>

        {/* Content */}
        <div className="p-5">
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600">{t('desktopRecommended.dontShowAgain')}</span>
          </label>

          <button
            onClick={handleClose}
            className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-lg transition-all"
          >
            {t('desktopRecommended.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};
