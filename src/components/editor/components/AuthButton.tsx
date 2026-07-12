import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from '@/components/editor/lib/router';
import { useTranslation } from 'react-i18next';
import {
  resolveSharedHeaderLanguage,
  sharedChromeCopy,
} from '@/components/header/shared';
import { cn } from '../utils/cn';
import { useAuth } from '../contexts/AuthContext';

export const AuthButton = () => {
  const { t, i18n } = useTranslation(['auth', 'common', 'message']);
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerLang = resolveSharedHeaderLanguage(i18n.language);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);

  if (loading || (user && profileLoading)) {
    return (
      <div className="flex items-center gap-2">
        <div className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (user) {
    const displayName = profile?.fullName || profile?.email || user.email || 'User';
    const avatarInitial = displayName.charAt(0).toUpperCase();
    const isPremium = profile?.subscriptionTier === 'premium';

    return (
      <div className="relative flex items-center" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-2 rounded-full focus:outline-none"
          aria-label={t('auth:profile')}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={displayName}
              className="size-9 rounded-full border border-white/15 object-cover"
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-white text-sm font-bold text-[#111]">
              {avatarInitial}
            </span>
          )}
          <span className="hidden max-w-[9rem] truncate text-sm text-white sm:block">
            {displayName}
          </span>
          <span
            className={cn(
              'hidden size-2 rounded-full sm:block',
              isPremium ? 'bg-amber-400' : 'bg-white/45'
            )}
            aria-hidden="true"
          />
          <svg
            className={cn(
              'hidden h-3 w-3 text-white/70 transition-transform duration-200 sm:block',
              isMenuOpen && 'rotate-180'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isMenuOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-2 max-h-[min(24rem,calc(100dvh-4.5rem))] w-60 overflow-y-auto overscroll-contain rounded-xl border border-[#2b2b2b] bg-[#151515] shadow-lg"
            role="menu"
          >
            <div className="border-b border-[#2b2b2b] px-4 py-3">
              <div className="flex items-center gap-3">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={displayName}
                    className="size-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-11 items-center justify-center rounded-full bg-white text-lg font-bold text-[#111]">
                    {avatarInitial}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-white">
                    {displayName}
                  </div>
                  <div className="truncate text-sm text-white/55">
                    {profile?.email || user.email}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {profile?.role === 'admin' && (
                      <span className="inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-200">
                        {t('auth:admin')}
                      </span>
                    )}
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      isPremium
                        ? 'bg-amber-500/15 text-amber-200'
                        : 'bg-white/8 text-white/70'
                    )}>
                      {profile?.subscriptionTier === 'premium' ? t('auth:premium') : t('auth:free')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Link
              to="/account"
              onClick={() => setIsMenuOpen(false)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-white transition-colors hover:bg-white/6"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{sharedChromeCopy[headerLang].account}</span>
            </Link>

            {profile?.role === 'admin' && (
              <>
                <Link
                  to="/admin"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-white transition-colors hover:bg-white/6"
                >
                  <span className="material-symbols-outlined text-[20px]">monitoring</span>
                  <span>{sharedChromeCopy[headerLang].adminDashboard}</span>
                </Link>
                <Link
                  to="/admin/content-factory"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-white transition-colors hover:bg-white/6"
                >
                  <span className="material-symbols-outlined text-[20px]">factory</span>
                  <span>{sharedChromeCopy[headerLang].contentFactory}</span>
                </Link>
                <Link
                  to="/lab"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-white transition-colors hover:bg-white/6"
                >
                  <span className="material-symbols-outlined text-[20px]">science</span>
                  <span>{sharedChromeCopy[headerLang].lab}</span>
                </Link>
                <Link
                  to="/episodes/new"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-white transition-colors hover:bg-white/6"
                >
                  <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                  <span>{sharedChromeCopy[headerLang].addEpisode}</span>
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={async () => {
                setIsMenuOpen(false);
                await signOut();
                navigate('/');
              }}
              className="flex w-full items-center gap-3 border-t border-[#2b2b2b] px-4 py-3 text-left text-white transition-colors hover:bg-white/6"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{sharedChromeCopy[headerLang].logout}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Send the user back to the current editor URL after signing in
  // (this island is client-only, so window is always available here).
  const loginNext = `${window.location.pathname}${window.location.search}`;

  return (
    <Link
      to={`/auth/login?next=${encodeURIComponent(loginNext)}`}
      className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/8"
    >
      {sharedChromeCopy[headerLang].login}
    </Link>
  );
};
