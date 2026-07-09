import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@/components/editor/lib/router';
import { useTranslation } from 'react-i18next';
import {
  resolveSharedHeaderLanguage,
  sharedChromeCopy,
  sharedNavCopy,
  sharedNavItems,
  sharedSocialLinks,
} from '@/components/header/shared';
import { cn } from '../utils/cn';
import { AuthButton } from './AuthButton';
import { LanguageSwitcher } from './LanguageSwitcher';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
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

  const closeMenu = useCallback(() => {
    setIsMenuClosing(true);
    window.setTimeout(() => {
      setIsMenuOpen(false);
      setIsMenuClosing(false);
    }, 180);
  }, []);

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
    closeMenu();
    if (onInternalNavigate) {
      await onInternalNavigate(href);
      return;
    }
    navigate(href);
  };

  return (
    <>
      <header className="sticky top-0 z-[90] border-b border-[#2b2b2b] bg-[#231b2f] px-3 md:px-6">
        {isEditorMode ? (
          <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-3 md:h-16">
            <div className="flex items-center justify-start">
              {onBackToManager ? (
                <button
                  onClick={onBackToManager}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 px-3 text-sm font-medium text-white transition-colors hover:bg-white/8"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">{t('banner:saveAndBack')}</span>
                </button>
              ) : (
                <div className="h-9 w-9" aria-hidden="true" />
              )}
            </div>

            <div className="flex min-w-0 items-center justify-center gap-2">
              {bannerName ? (
                isEditing ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    onBlur={handleSaveName}
                    className="w-full max-w-xs rounded-md border border-white/20 bg-white/95 px-3 py-1.5 text-center text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/40"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={bannerId && onBannerNameChange ? handleStartEdit : undefined}
                    className={cn(
                      'max-w-full truncate rounded-md px-2 py-1 text-sm font-medium text-white',
                      bannerId && onBannerNameChange && 'cursor-text transition-colors hover:bg-white/8'
                    )}
                  >
                    {bannerName}
                  </button>
                )
              ) : (
                <button type="button" onClick={() => void handleInternalNavigation('/')} className="flex-shrink-0">
                  <img src="/logo_imagine_white.svg" alt="IMAGINE" className="h-6 md:h-7" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              {isAdmin && bannerId && onSaveAsTemplate ? (
                <button
                  onClick={onSaveAsTemplate}
                  className="hidden h-9 items-center gap-1 rounded-full border border-white/15 px-3 text-xs font-medium text-white transition-colors hover:bg-white/8 md:inline-flex"
                  title="テンプレートに登録"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span>テンプレート登録</span>
                </button>
              ) : null}
              <LanguageSwitcher />
              <button
                type="button"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
                onClick={() => (isMenuOpen ? closeMenu() : setIsMenuOpen(true))}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/8"
              >
                <span className="flex h-4 w-5 flex-col items-center justify-center">
                  <span className={cn('block h-[1.5px] w-full rounded-full bg-current transition-all duration-200', isMenuOpen ? 'translate-y-[3px] rotate-45' : 'translate-y-[-3px]')} />
                  <span className={cn('block h-[1.5px] w-full rounded-full bg-current transition-all duration-200', isMenuOpen ? 'scale-x-0 opacity-0' : 'opacity-100')} />
                  <span className={cn('block h-[1.5px] w-full rounded-full bg-current transition-all duration-200', isMenuOpen ? '-translate-y-[3px] -rotate-45' : 'translate-y-[3px]')} />
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 md:h-16 md:gap-4">
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
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
                onClick={() => (isMenuOpen ? closeMenu() : setIsMenuOpen(true))}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/8"
              >
                <span className="flex h-4 w-5 flex-col items-center justify-center">
                  <span className={cn('block h-[1.5px] w-full rounded-full bg-current transition-all duration-200', isMenuOpen ? 'translate-y-[3px] rotate-45' : 'translate-y-[-3px]')} />
                  <span className={cn('block h-[1.5px] w-full rounded-full bg-current transition-all duration-200', isMenuOpen ? 'scale-x-0 opacity-0' : 'opacity-100')} />
                  <span className={cn('block h-[1.5px] w-full rounded-full bg-current transition-all duration-200', isMenuOpen ? '-translate-y-[3px] -rotate-45' : 'translate-y-[3px]')} />
                </span>
              </button>
            </div>
          </div>
        )}
      </header>

      {isMenuOpen &&
        createPortal(
          <div
            className={cn(
              'fixed inset-0 z-[110] overflow-y-auto bg-[#111111]',
              isMenuClosing ? 'menu-overlay-exit' : 'menu-overlay-enter'
            )}
          >
            <div className="mx-auto flex min-h-full max-w-5xl flex-col px-6 py-8 text-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/45">
                  {sharedChromeCopy[headerLang].menu}
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={closeMenu}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/8"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="mt-10 flex flex-col">
                {sharedNavItems.map((item, i) => {
                  const copy = sharedNavCopy[headerLang][item.key];
                  const delay = `${80 + i * 60}ms`;

                  if (item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeMenu}
                        className="menu-item-slide group flex items-center justify-between rounded-xl px-4 py-4 transition-colors hover:bg-white/6"
                        style={{ animationDelay: delay }}
                      >
                        <div className="flex max-w-3xl flex-col gap-1.5">
                          <span className="text-2xl font-bold sm:text-3xl">{copy.label}</span>
                          <span className="text-sm leading-relaxed text-white/55">{copy.description}</span>
                        </div>
                        <svg className="h-4 w-4 text-white/45 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                        </svg>
                      </a>
                    );
                  }

                  return (
                    <button
                      type="button"
                      key={item.href}
                      onClick={() => void handleInternalNavigation(item.href)}
                      className="menu-item-slide group flex items-center justify-between rounded-xl px-4 py-4 text-left transition-colors hover:bg-white/6"
                      style={{ animationDelay: delay }}
                    >
                      <div className="flex max-w-3xl flex-col gap-1.5">
                        <span className="text-2xl font-bold sm:text-3xl">{copy.label}</span>
                        <span className="text-sm leading-relaxed text-white/55">{copy.description}</span>
                      </div>
                      <svg className="h-5 w-5 text-white/45 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto border-t border-white/10 pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">
                    &copy; {new Date().getFullYear()} WHATIF EP
                  </p>
                  <div className="flex items-center gap-4">
                    {sharedSocialLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white/55 transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
