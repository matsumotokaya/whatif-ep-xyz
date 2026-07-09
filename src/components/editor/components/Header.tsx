import { useEffect, useState } from 'react';
import { useNavigate } from '@/components/editor/lib/router';
import { useTranslation } from 'react-i18next';
import {
  resolveSharedHeaderLanguage,
  sharedChromeCopy,
  sharedNavCopy,
  sharedNavItems,
  sharedSocialLinks,
} from '@/components/header/shared';
import { AuthButton } from './AuthButton';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ReleaseNotesModal } from './ReleaseNotesModal';

interface HeaderProps {
  onBackToManager?: () => void;
  onInternalNavigate?: (href: string) => Promise<void> | void;
  bannerName?: string;
  bannerId?: string;
  onBannerNameChange?: (newName: string) => void;
  onSaveAsTemplate?: () => void;
  isAdmin?: boolean;
}

export const Header = ({ onBackToManager, onInternalNavigate, bannerName, bannerId, onBannerNameChange, onSaveAsTemplate, isAdmin }: HeaderProps) => {
  const { t, i18n } = useTranslation(['banner', 'common', 'auth']);
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isEditorMode = Boolean(onBackToManager || bannerName || onBannerNameChange || onSaveAsTemplate);
  const headerLang = resolveSharedHeaderLanguage(i18n.language);

  useEffect(() => {
    if (!isMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

  const handleStartEdit = () => {
    if (bannerName) {
      setEditingName(bannerName);
      setIsEditing(true);
    }
  };

  const handleSaveName = () => {
    if (editingName.trim() && onBannerNameChange) {
      onBannerNameChange(editingName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingName('');
  };

  const handleInternalNavigation = async (href: string) => {
    setIsMenuOpen(false);
    if (onInternalNavigate) {
      await onInternalNavigate(href);
      return;
    }
    navigate(href);
  };

  const editorControls = (
    <>
      {onBackToManager ? (
        <button
          onClick={onBackToManager}
          className="h-8 md:h-9 px-3 md:px-4 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-1.5 md:gap-2 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-white text-xs md:text-sm font-medium whitespace-nowrap">{t('banner:saveAndBack')}</span>
        </button>
      ) : null}
      {bannerName ? (
        <>
          <span className="hidden sm:inline text-white/50">|</span>
          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              onBlur={handleSaveName}
              className="hidden sm:block px-2 py-1 bg-white/90 text-gray-900 rounded border-2 border-white focus:outline-none focus:ring-2 focus:ring-white/50 font-medium text-sm"
              autoFocus
            />
          ) : (
            <div className="hidden sm:flex items-center gap-2 group/title">
              {bannerId && onBannerNameChange ? (
                <span
                  onClick={handleStartEdit}
                  className="text-white font-medium text-sm md:text-base truncate max-w-[150px] md:max-w-none cursor-text hover:bg-white/10 px-1.5 py-0.5 -mx-1.5 rounded transition-colors"
                >
                  {bannerName}
                </span>
              ) : (
                <span className="text-white font-medium text-sm md:text-base truncate max-w-[150px] md:max-w-none">{bannerName}</span>
              )}
              {isAdmin && bannerId && onSaveAsTemplate ? (
                <button
                  onClick={onSaveAsTemplate}
                  className="ml-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                  title="テンプレートに登録"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span className="hidden md:inline">テンプレート登録</span>
                </button>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-[90] bg-[#231b2f]/95 backdrop-blur-sm border-b border-[#2b2b2b] px-3 md:px-6">
        {isEditorMode ? (
          <div className="h-14 md:h-16 flex items-center justify-end gap-2 md:gap-3">
            <button
              onClick={() => setIsReleaseNotesOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">new_releases</span>
              <span>Release Notes</span>
            </button>
            {editorControls}
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="h-9 w-9 md:h-10 md:w-10 inline-flex items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors"
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="grid h-14 md:h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">
            <div className="flex items-center justify-start min-w-0">
              <AuthButton />
            </div>
            <div className="flex items-center justify-center">
              <button type="button" onClick={() => void handleInternalNavigation('/')} className="flex-shrink-0">
                <img src="/logo_imagine_white.svg" alt="IMAGINE" className="h-6 md:h-7 flex-shrink-0" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 md:gap-3 min-w-0">
              <LanguageSwitcher />
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                className="h-9 w-9 md:h-10 md:w-10 inline-flex items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors"
                aria-label="Open navigation menu"
                aria-expanded={isMenuOpen}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </header>

      <div
        className={`fixed inset-0 z-[100] bg-black/60 transition-opacity ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMenuOpen(false)}
      />

      <aside
        className={`fixed top-0 right-0 z-[110] h-dvh w-[90vw] max-w-sm bg-[#151515] border-l border-gray-800 transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!isMenuOpen}
      >
        <div className="h-full flex flex-col">
          <div className="h-14 md:h-16 px-4 border-b border-gray-800 flex items-center justify-between">
            <img src="/logo_imagine_white.svg" alt="IMAGINE" className="h-6" />
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors"
              aria-label="Close navigation menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <div className="mb-6 text-[11px] uppercase tracking-[0.3em] text-gray-500">
              {sharedChromeCopy[headerLang].menu}
            </div>
            <div className="flex flex-col gap-2">
              {sharedNavItems.map((item) => {
                const copy = sharedNavCopy[headerLang][item.key];

                if (item.external) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsMenuOpen(false)}
                      className="rounded-xl border border-gray-800 px-4 py-3 text-left text-gray-100 hover:border-gray-600 hover:bg-gray-900 transition-colors"
                    >
                      <div className="text-base font-semibold">{copy.label}</div>
                      <div className="mt-1 text-sm leading-relaxed text-gray-400">{copy.description}</div>
                    </a>
                  );
                }

                return (
                  <button
                    type="button"
                    key={item.href}
                    onClick={() => void handleInternalNavigation(item.href)}
                    className="rounded-xl border border-gray-800 px-4 py-3 text-left text-gray-100 hover:border-gray-600 hover:bg-gray-900 transition-colors"
                  >
                    <div className="text-base font-semibold">{copy.label}</div>
                    <div className="mt-1 text-sm leading-relaxed text-gray-400">{copy.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 border-t border-gray-800 pt-5">
              <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-gray-500">Social</div>
              <div className="flex flex-col gap-2">
                {sharedSocialLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-lg border border-gray-800 px-3 py-2 text-sm font-medium text-gray-100 hover:border-gray-600 hover:bg-gray-900 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </aside>

      <ReleaseNotesModal isOpen={isReleaseNotesOpen} onClose={() => setIsReleaseNotesOpen(false)} />
    </>
  );
};
