// My Designs list, ported from IMAGINE's src/pages/BannerManager.tsx
// (docs/archive/CONSOLIDATION_PLAN.md M4, brought forward).
//
// Differences from the IMAGINE original:
// - Routes: /banner/:id -> /edit/:id, /banner -> /edit, /banners/:sizeKey ->
//   /mydesign/:sizeKey. Empty-state "view templates" points to the Gallery
//   works list (/works/episode) because the template gallery page is not
//   ported yet (M4).
// - The Content Factory list now lives at /mydesign/factory (M4,
//   FactoryProjectManager). GalleryTabs / the IMAGINE Footer exist as island
//   components but this page keeps its original chrome.
// - Guests get an explicit "log in to save more designs" notice above their
//   single localStorage design.

import { useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from '@/components/editor/lib/router';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { GalleryTabs } from '../components/GalleryTabs';
import { Footer } from '../components/Footer';
import { PreviewStatusBadge } from '../components/PreviewStatusBadge';
import { SortableGrid } from '../components/SortableGrid';
import {
  useBanners,
  useCreateBanner,
  useDeleteBanner,
  useDuplicateBanner,
  useUpdateBannerName,
} from '../hooks/useBanners';
import { DEFAULT_TEMPLATES } from '../templates/defaultTemplates';
import type { BannerListItem, CanvasElement, Template } from '../types/template';
import { useAuth } from '../contexts/AuthContext';
import { GUEST_STORAGE_KEY, readGuestBannerListItem } from '../utils/guestDesign';
import { filterBySize, getAspectClass, getAvailableSizeCategories, getGridCols } from '../utils/sizeCategories';
import { downloadImageFromUrl } from '../utils/exportImage';

const MAX_DISPLAY_COUNT = 10;

export const BannerManager = () => {
  const { t, i18n } = useTranslation(['banner', 'common', 'message', 'auth']);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isGuest = !user;
  // Guest's single design lives in localStorage. This island is client-only,
  // so reading it during render (memoized on isGuest) is safe and avoids a
  // setState-in-effect cascade.
  const guestBanner = useMemo(() => (isGuest ? readGuestBannerListItem() : null), [isGuest]);

  // React Query hooks
  const { data: banners = [], isLoading } = useBanners(user?.id, !authLoading && !!user);
  const createBanner = useCreateBanner();
  const deleteBanner = useDeleteBanner();
  const duplicateBanner = useDuplicateBanner();
  const updateName = useUpdateBannerName(editingId || '');

  const handleCreateBanner = async () => {
    const result = await createBanner.mutateAsync({
      name: t('message:placeholder.untitledBanner'),
      template: DEFAULT_TEMPLATES[0],
    });
    if (result) {
      navigate(`/edit/${result.id}`);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (window.confirm(t('message:confirm.deleteBanner'))) {
      await deleteBanner.mutateAsync(id);
    }
  };

  const handleDuplicateBanner = async (id: string) => {
    await duplicateBanner.mutateAsync(id);
  };

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveName = async () => {
    if (editingName.trim()) {
      await updateName.mutateAsync(editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleBannerClick = (banner: BannerListItem) => {
    const returnTo = `${location.pathname}${location.search}`;

    if (isGuest && banner.id === 'guest') {
      try {
        const stored = localStorage.getItem(GUEST_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored) as {
          name: string;
          template: Template;
          elements: CanvasElement[];
          canvasColor: string;
        };
        navigate('/edit', {
          state: {
            template: parsed.template,
            elements: parsed.elements,
            canvasColor: parsed.canvasColor,
            name: parsed.name,
            templateId: parsed.template.id,
          },
        });
      } catch (error) {
        console.warn('[BannerManager] Failed to open guest banner:', error);
      }
      return;
    }
    navigate(`/edit/${banner.id}`, {
      state: { returnTo },
    });
  };

  const handleDownloadBanner = async (banner: BannerListItem) => {
    if (!banner.fullresUrl) {
      alert(t('banner:downloadUnavailable'));
      return;
    }

    try {
      await downloadImageFromUrl(banner.fullresUrl, `${banner.name}.png`);
    } catch (error) {
      console.error('Failed to download banner asset:', error);
      alert(t('message:error.exportFailed'));
    }
  };

  const displayedBanners = isGuest ? (guestBanner ? [guestBanner] : []) : banners;
  const availableSizeCategories = getAvailableSizeCategories(displayedBanners);

  // Filter banners by size category
  const filterBannersBySize = (targetWidth: number, targetHeight: number) => {
    return filterBySize(displayedBanners, targetWidth, targetHeight);
  };

  // Render a single banner card
  const renderBannerCard = (banner: BannerListItem) => {
    const isGuestBanner = isGuest && banner.id === 'guest';
    const aspectClass = getAspectClass(banner.width, banner.height);
    const isPreviewGenerating = banner.previewStatus === 'pending' && Boolean(banner.previewRequestedAt);

    return (
      <div
        key={banner.id}
        className="group bg-white rounded-lg border border-gray-200 hover:border-indigo-400 hover:shadow-lg transition-all overflow-hidden"
      >
        <div
          className={`${aspectClass} bg-gray-100 cursor-pointer relative overflow-hidden`}
          onClick={() => handleBannerClick(banner)}
        >
          <PreviewStatusBadge
            status={banner.previewStatus}
            requestedAt={banner.previewRequestedAt}
            error={banner.previewError}
            className="absolute right-2 top-2 z-10"
          />
          {banner.thumbnailUrl ? (
            <>
              {imageLoadingStates[banner.id] && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-indigo-400 rounded-full blur-md opacity-30 animate-pulse"></div>
                      <div className="relative animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                    <span className="text-sm font-medium text-indigo-700">{t('common:thumbnail.loading')}</span>
                  </div>
                </div>
              )}
              <img
                src={banner.thumbnailUrl}
                alt={banner.name}
                className="w-full h-full object-cover"
                onLoadStart={() => {
                  setImageLoadingStates((prev) => ({ ...prev, [banner.id]: true }));
                }}
                onLoad={() => {
                  setImageLoadingStates((prev) => ({ ...prev, [banner.id]: false }));
                }}
                onError={() => {
                  setImageLoadingStates((prev) => ({ ...prev, [banner.id]: false }));
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gray-300 rounded-2xl blur-xl opacity-20"></div>
                  <svg
                    className="relative w-14 h-14 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-400">
                  {isPreviewGenerating
                    ? t('common:thumbnail.generating')
                    : banner.previewStatus === 'failed'
                      ? t('common:thumbnail.failed')
                      : t('common:thumbnail.noThumbnail')}
                </span>
              </div>
            </div>
          )}

          {/* Semi-transparent overlay with banner info */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pt-8">
            {editingId === banner.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                onBlur={() => handleSaveName()}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-sm font-medium bg-white/90 border border-indigo-500 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1 mb-1">
                <h3 className="font-medium text-white text-sm truncate flex-1">{banner.name}</h3>
                {!isGuestBanner && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(banner.id, banner.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded transition-all"
                    title={t('banner:editName')}
                  >
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-white/80">{formatDate(banner.updatedAt)}</p>
          </div>

          {/* Action buttons overlay (top right) */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleDownloadBanner(banner);
              }}
              disabled={!banner.fullresUrl}
              className="w-7 h-7 bg-white/90 hover:bg-white text-gray-700 rounded-md transition-colors flex items-center justify-center group/download relative shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title={banner.fullresUrl ? t('banner:download') : t('banner:downloadUnavailable')}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span className="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/download:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {banner.fullresUrl ? t('banner:download') : t('banner:downloadUnavailable')}
              </span>
            </button>
            {!isGuest && (
              <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateBanner(banner.id);
                }}
                disabled={duplicateBanner.isPending}
                className="w-7 h-7 bg-white/90 hover:bg-white text-gray-700 rounded-md transition-colors flex items-center justify-center group/duplicate relative shadow-sm disabled:opacity-50"
                title={t('banner:duplicate')}
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span className="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/duplicate:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {t('banner:duplicate')}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBanner(banner.id);
                }}
                disabled={deleteBanner.isPending}
                className="w-7 h-7 bg-white/90 hover:bg-white text-red-600 rounded-md transition-colors flex items-center justify-center group/delete relative shadow-sm disabled:opacity-50"
                title={t('banner:delete')}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span className="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/delete:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {t('banner:delete')}
                </span>
              </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#101010]">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <GalleryTabs />

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-100">
            {t('banner:title')} ({displayedBanners.length})
          </h2>
        </div>

        {/* Guest notice: a guest can keep exactly one design in localStorage */}
        {!authLoading && isGuest && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-4 py-3">
            <p className="flex-1 text-sm text-gray-200">{t('banner:guestListNotice')}</p>
            <Link
              to={`/auth/login?next=${encodeURIComponent('/mydesign')}`}
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t('auth:login')}
            </Link>
          </div>
        )}

        {authLoading || isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">{t('common:status.loading')}</p>
          </div>
        ) : displayedBanners.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700 mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">{t('banner:noBanners')}</h3>
            <p className="text-gray-400 mb-6">{t('banner:emptyStateMessage')}</p>
            <button
              onClick={() => navigate('/works/episode')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              {t('banner:viewTemplates')}
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {availableSizeCategories.map((category) => {
              const filteredBanners = filterBannersBySize(category.width, category.height);
              if (filteredBanners.length === 0) return null;
              const displayBanners = filteredBanners.slice(0, MAX_DISPLAY_COUNT);
              const hasMore = filteredBanners.length > MAX_DISPLAY_COUNT;
              const gridCols = getGridCols(category.width, category.height);

              return (
                <section key={category.key}>
                  <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/mydesign/${category.key}`)}
                      className="hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                      {category.label}
                    </button>
                    <span className="text-sm font-normal text-gray-400">
                      ({category.width}×{category.height})
                    </span>
                    <span className="text-sm font-normal text-gray-500">
                      — {t('common:items', { count: filteredBanners.length })}
                    </span>
                  </h3>

                  <SortableGrid
                    items={displayBanners}
                    disabled
                    gridClassName={`grid ${gridCols} gap-4`}
                    onReorder={() => {}}
                    renderItem={renderBannerCard}
                  />
                  {hasMore && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => navigate(`/mydesign/${category.key}`)}
                        className="px-6 py-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/30 rounded-lg transition-colors"
                      >
                        {t('common:showMore', { count: filteredBanners.length - MAX_DISPLAY_COUNT })}
                        <span className="ml-1">→</span>
                      </button>
                    </div>
                  )}
                </section>
              );
            })}

            {/* Add new banner card - shown at bottom */}
            {!isGuest && (
              <section>
                <h3 className="text-lg font-semibold text-gray-100 mb-4">{t('banner:createNew')}</h3>
                <div
                  onClick={handleCreateBanner}
                  className="group bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:shadow-lg transition-all overflow-hidden cursor-pointer w-48"
                >
                  <div className="aspect-[9/16] bg-gray-50 flex items-center justify-center">
                    <div className="text-center px-4">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">
                        {t('banner:newBanner')}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
