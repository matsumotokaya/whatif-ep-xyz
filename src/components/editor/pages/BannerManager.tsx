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
import { SortableGrid } from '../components/SortableGrid';
import { BannerCard } from '../components/BannerCard';
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
import { filterBySize, getAvailableSizeCategories, getGridCols } from '../utils/sizeCategories';

const MAX_DISPLAY_COUNT = 10;

export const BannerManager = () => {
  const { t } = useTranslation(['banner', 'common', 'message', 'auth']);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
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

  const displayedBanners = isGuest ? (guestBanner ? [guestBanner] : []) : banners;
  const availableSizeCategories = getAvailableSizeCategories(displayedBanners);

  // Filter banners by size category
  const filterBannersBySize = (targetWidth: number, targetHeight: number) => {
    return filterBySize(displayedBanners, targetWidth, targetHeight);
  };

  // Render a single banner card
  const renderBannerCard = (banner: BannerListItem) => (
    <BannerCard
      banner={banner}
      isGuest={isGuest}
      isEditingName={editingId === banner.id}
      editingName={editingName}
      onEditingNameChange={setEditingName}
      onStartEditName={() => handleStartEdit(banner.id, banner.name)}
      onSaveName={() => void handleSaveName()}
      onCancelEditName={handleCancelEdit}
      onOpen={() => handleBannerClick(banner)}
      onDuplicate={() => void handleDuplicateBanner(banner.id)}
      onDelete={() => void handleDeleteBanner(banner.id)}
      duplicateDisabled={duplicateBanner.isPending}
      deleteDisabled={deleteBanner.isPending}
    />
  );

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
