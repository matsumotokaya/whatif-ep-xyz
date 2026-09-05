// Size-filtered design list (/mydesign/[sizeKey]), ported from IMAGINE's
// src/pages/BannersBySize.tsx (docs/archive/CONSOLIDATION_PLAN.md M4, brought forward).
//
// Differences from the IMAGINE original:
// - Routes: /banner/:id -> /edit/:id, /banner -> /edit, list -> /mydesign.
// - Content Factory has its own list at /mydesign/factory (M4); the
//   ?source=factory view of this page was not ported. The IMAGINE Footer is
//   available (components/Footer) but this list page keeps its own layout.

import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from '@/components/editor/lib/router';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { GalleryTabs } from '../components/GalleryTabs';
import { Footer } from '../components/Footer';
import { SortableGrid } from '../components/SortableGrid';
import { BannerCard } from '../components/BannerCard';
import {
  useBanners,
  useDeleteBanner,
  useDuplicateBanner,
  useUpdateBannerName,
} from '../hooks/useBanners';
import type { BannerListItem, CanvasElement, Template } from '../types/template';
import { useAuth } from '../contexts/AuthContext';
import { GUEST_STORAGE_KEY, readGuestBannerListItem } from '../utils/guestDesign';
import { filterBySize, getGridCols, resolveSizeCategory } from '../utils/sizeCategories';

const LIST_PATH = '/mydesign';

export const BannersBySize = () => {
  const { sizeKey } = useParams<{ sizeKey: string }>();
  const { t } = useTranslation(['banner', 'common', 'message']);
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
  const deleteBanner = useDeleteBanner();
  const duplicateBanner = useDuplicateBanner();
  const updateName = useUpdateBannerName(editingId || '');

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
      } catch {
        // Ignore error
      }
      return;
    }
    navigate(`/edit/${banner.id}`, {
      state: { returnTo },
    });
  };

  const displayedBanners = isGuest ? (guestBanner ? [guestBanner] : []) : banners;
  const category = resolveSizeCategory(sizeKey, displayedBanners);

  // Filter banners by the current category size
  const filteredBanners = category
    ? filterBySize(displayedBanners, category.width, category.height)
    : [];

  // Grid columns based on aspect ratio
  const gridCols = category
    ? getGridCols(category.width, category.height)
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

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

  // If category not found, show error
  if (!category) {
    return (
      <div className="min-h-screen bg-[#101010]">
        <Header />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <GalleryTabs />

          <div className="text-center py-20">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">{t('banner:categoryNotFound')}</h2>
            <button
              onClick={() => navigate(LIST_PATH)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              {t('banner:backToDesigns')}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101010]">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <GalleryTabs />

        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-gray-400">
            <li>
              <button
                onClick={() => navigate(LIST_PATH)}
                className="hover:text-indigo-400 transition-colors"
              >
                {t('banner:title')}
              </button>
            </li>
            <li>/</li>
            <li className="text-gray-100">{category.label}</li>
          </ol>
        </nav>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            {category.label}
            <span className="text-sm font-normal text-gray-400">
              ({category.width}×{category.height})
            </span>
            <span className="text-sm font-normal text-gray-500">— {t('common:items', { count: filteredBanners.length })}</span>
          </h2>
        </div>

        {authLoading || isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">{t('common:status.loading')}</p>
          </div>
        ) : filteredBanners.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700 mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">{t('banner:noDesignsForSize')}</h3>
            <p className="text-gray-400 mb-6">{t('banner:createDesignFromTemplate')}</p>
            <button
              onClick={() => navigate(LIST_PATH)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              {t('banner:backToDesigns')}
            </button>
          </div>
        ) : (
          <SortableGrid
            items={filteredBanners}
            disabled
            gridClassName={`grid ${gridCols} gap-4`}
            onReorder={() => {}}
            renderItem={renderBannerCard}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};
