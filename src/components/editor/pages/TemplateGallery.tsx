import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { GalleryTabs } from '../components/GalleryTabs';
import { UpgradeModal } from '../components/UpgradeModal';
import { EditTemplateModal } from '../components/EditTemplateModal';
import { Footer } from '../components/Footer';
import { SortableGrid } from '../components/SortableGrid';
import { LikeButton } from '../components/LikeButton';
import { DemoCanvas } from '../components/DemoCanvas';
import { GuestLimitModal } from '../components/GuestLimitModal';
import { TemplateWallpaperExporter } from '../components/TemplateWallpaperExporter';
import { useTemplates, templateKeys } from '../hooks/useTemplates';
import { useOpenTemplate } from '../hooks/useOpenTemplate';
import { DEFAULT_TEMPLATES } from '../templates/defaultTemplates';
import type { Template, TemplateRecord } from '../types/template';
import { useAuth } from '../contexts/AuthContext';
import { templateStorage } from '../utils/templateStorage';
import {
  filterBySize,
  getAspectClass,
  getAvailableSizeCategories,
  getGridCols,
} from '../utils/sizeCategories';
import { Link, useNavigate } from '../lib/router';

const MAX_DISPLAY_COUNT = 30;

export const TemplateGallery = () => {
  const { t } = useTranslation(['banner', 'common', 'message', 'auth', 'modal']);
  const [templateImageLoadingStates, setTemplateImageLoadingStates] = useState<
    Record<string, boolean>
  >({});
  const [templateActionId, setTemplateActionId] = useState<string | null>(null);
  const [templateDownloadId, setTemplateDownloadId] = useState<string | null>(null);
  const [downloadTemplate, setDownloadTemplate] = useState<TemplateRecord | null>(null);
  const [pendingGuestTemplate, setPendingGuestTemplate] =
    useState<TemplateRecord | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRecord | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const isGuest = !user;
  const isAdmin = profile?.role === 'admin';

  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const availableSizeCategories = getAvailableSizeCategories(templates);

  const handleReorderTemplates = async (reorderedTemplates: TemplateRecord[]) => {
    const orders = reorderedTemplates.map((template, index) => ({
      id: template.id,
      displayOrder: index + 1,
    }));

    try {
      await templateStorage.updateDisplayOrders(orders);
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    } catch (error) {
      console.error('Failed to update display orders:', error);
    }
  };

  const filterTemplatesBySize = (targetWidth: number, targetHeight: number) =>
    filterBySize(templates, targetWidth, targetHeight);

  const buildEditorTemplate = (template: TemplateRecord): Template => {
    const fallbackTemplate = DEFAULT_TEMPLATES[0];
    return {
      id: template.id,
      name: template.name,
      width: template.width ?? fallbackTemplate.width,
      height: template.height ?? fallbackTemplate.height,
      backgroundColor: template.canvasColor,
      thumbnail: template.thumbnailUrl,
      planType: template.planType,
    };
  };

  const handleTemplateClick = useOpenTemplate({
    onUpgradeRequired: () => setShowUpgradeModal(true),
    onLoginRequired: () =>
      navigate(`/auth/login?next=${encodeURIComponent('/imagine')}`),
    onGuestConflict: (template) => setPendingGuestTemplate(template),
    onCreatingChange: setTemplateActionId,
  });

  const handleTemplateWallpaperDownload = async (template: TemplateRecord) => {
    const resolvedTemplate = template.elements
      ? template
      : await templateStorage.getById(template.id);
    if (!resolvedTemplate?.elements) {
      alert(t('banner:templateLoadFailed'));
      return;
    }

    setTemplateDownloadId(template.id);
    setDownloadTemplate(resolvedTemplate);
  };

  const renderTemplateCard = (template: TemplateRecord) => {
    const aspectClass = getAspectClass(template.width, template.height);

    return (
      <div
        key={template.id}
        className="group overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-indigo-400 hover:shadow-lg"
      >
        <div
          className={`${aspectClass} relative cursor-pointer overflow-hidden bg-gray-100`}
          onClick={() => handleTemplateClick(template)}
        >
          {template.thumbnailUrl ? (
            <>
              {templateImageLoadingStates[template.id] && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
                    <span className="text-xs text-gray-500">
                      {t('common:status.loading')}
                    </span>
                  </div>
                </div>
              )}
              <img
                src={template.thumbnailUrl}
                alt={template.name}
                className="h-full w-full object-cover"
                onLoadStart={() => {
                  setTemplateImageLoadingStates((prev) => ({
                    ...prev,
                    [template.id]: true,
                  }));
                }}
                onLoad={() => {
                  setTemplateImageLoadingStates((prev) => ({
                    ...prev,
                    [template.id]: false,
                  }));
                }}
                onError={() => {
                  setTemplateImageLoadingStates((prev) => ({
                    ...prev,
                    [template.id]: false,
                  }));
                }}
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-50">
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="h-12 w-12 text-gray-300"
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
                <span className="text-xs text-gray-400">
                  {t('common:thumbnail.noThumbnail')}
                </span>
              </div>
            </div>
          )}

          <div className="absolute left-2 top-2 flex flex-col gap-1">
            <div
              className={`inline-flex h-6 items-center rounded-md px-2 text-white shadow ${
                template.planType === 'premium'
                  ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                  : 'bg-emerald-500/90'
              }`}
            >
              <span className="text-xs font-bold">
                {template.planType === 'premium' ? 'PREMIUM' : 'FREE'}
              </span>
            </div>
          </div>

          <div
            className="absolute right-2 top-2 z-10"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <LikeButton templateId={template.id} likeCount={template.likeCount ?? 0} />
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex flex-col items-center gap-2">
              <button
                className="w-28 rounded bg-white/95 py-2 text-xs font-semibold text-gray-900 shadow-sm hover:bg-white"
                disabled={templateActionId === template.id}
              >
                {templateActionId === template.id
                  ? t('common:status.creating')
                  : t('banner:open')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleTemplateWallpaperDownload(template);
                }}
                className="w-28 rounded bg-indigo-600/95 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                disabled={templateDownloadId === template.id}
              >
                {templateDownloadId === template.id
                  ? t('common:status.loading')
                  : t('banner:wallpaperDownload')}
              </button>
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTemplate(template);
                  }}
                  className="w-28 rounded bg-gray-900 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gray-800"
                >
                  {t('modal:editTemplate.editButton')}
                </button>
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pt-8">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-medium text-white">{template.name}</h3>
              {(template.openCount ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 whitespace-nowrap text-[11px] text-white/50">
                  <span className="material-symbols-outlined text-[13px]">person</span>
                  {template.openCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#101010]">
      <Header />

      {isGuest && (
        <section className="px-6 pb-24 pt-20">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="mb-6 text-5xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
              {t('common:hero.headline1')}{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t('common:hero.headline2')}
              </span>
              <br />
              <span className="text-4xl font-medium text-gray-400 md:text-5xl lg:text-6xl">
                {t('common:hero.headline3')}
              </span>
            </h1>

            <p className="mx-auto mb-16 max-w-3xl text-lg leading-[1.3] text-gray-400 md:text-xl">
              {t('common:hero.description')}
            </p>

            <div className="mx-auto flex max-w-5xl justify-center px-4">
              <div className="w-full max-w-[90vw] md:hidden">
                <DemoCanvas scale={0.16} />
              </div>
              <div className="hidden md:block lg:hidden">
                <DemoCanvas scale={0.35} />
              </div>
              <div className="hidden lg:block">
                <DemoCanvas scale={0.45} />
              </div>
            </div>
          </div>
        </section>
      )}

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-10 border-t border-gray-800 pt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            {t('common:templatePromo.eyebrow')}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-100 md:text-3xl">
            {t('common:templatePromo.title')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-400 md:text-base">
            {t('common:templatePromo.description')}
          </p>
        </section>

        <GalleryTabs />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">
            {t('banner:templatesTitle')} ({templates.length})
          </h2>
        </div>

        {templatesLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
            <p className="mt-3 text-gray-600">{t('common:status.loading')}</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="py-12 text-center text-gray-400">{t('banner:noTemplates')}</div>
        ) : (
          <div className="space-y-10">
            {availableSizeCategories.map((category) => {
              const filteredTemplates = filterTemplatesBySize(
                category.width,
                category.height
              );
              if (filteredTemplates.length === 0) return null;

              const displayTemplates = filteredTemplates.slice(0, MAX_DISPLAY_COUNT);
              const hasMore = filteredTemplates.length > MAX_DISPLAY_COUNT;
              const gridCols = getGridCols(category.width, category.height);

              return (
                <section key={category.key}>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-100">
                    <Link
                      to={`/imagine/${category.key}`}
                      className="cursor-pointer transition-colors hover:text-indigo-400"
                    >
                      {category.label}
                    </Link>
                    <span className="text-sm font-normal text-gray-400">
                      ({category.width}×{category.height})
                    </span>
                    <span className="text-sm font-normal text-gray-500">
                      — {t('common:items', { count: filteredTemplates.length })}
                    </span>
                  </h3>

                  <SortableGrid
                    items={displayTemplates}
                    disabled={!isAdmin}
                    gridClassName={`grid ${gridCols} gap-4`}
                    onReorder={handleReorderTemplates}
                    renderItem={renderTemplateCard}
                  />
                  {hasMore && (
                    <div className="mt-4 text-center">
                      <Link
                        to={`/imagine/${category.key}`}
                        className="rounded-lg px-6 py-2 text-sm font-medium text-indigo-400 transition-colors hover:bg-indigo-900/30 hover:text-indigo-300"
                      >
                        {t('common:showMore', {
                          count: filteredTemplates.length - MAX_DISPLAY_COUNT,
                        })}
                        <span className="ml-1">→</span>
                      </Link>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <TemplateWallpaperExporter
        template={downloadTemplate}
        onComplete={(result) => {
          if (result.isIOS && result.method !== 'share-files') {
            alert(t('message:info.saveImageGuide'));
          }
          if (result.inAppBrowser) {
            alert(t('message:info.inAppBrowserGuide'));
          }
          setTemplateDownloadId(null);
          setDownloadTemplate(null);
        }}
        onError={(error) => {
          if (error.name !== 'AbortError') {
            alert(t('message:error.exportFailed'));
          }
          setTemplateDownloadId(null);
          setDownloadTemplate(null);
        }}
      />

      <GuestLimitModal
        isOpen={!!pendingGuestTemplate}
        onClose={() => setPendingGuestTemplate(null)}
        title={t('banner:guestLimitTitle')}
        message={t('banner:guestOverwriteConfirm')}
        cancelLabel={t('common:button.cancel')}
        confirmLabel={t('banner:open')}
        onConfirm={() => {
          if (!pendingGuestTemplate) return;

          const editorTemplate = buildEditorTemplate(pendingGuestTemplate);
          const templateElements = JSON.parse(
            JSON.stringify(pendingGuestTemplate.elements || [])
          );

          setPendingGuestTemplate(null);
          navigate('/edit', {
            state: {
              template: editorTemplate,
              elements: templateElements,
              canvasColor: pendingGuestTemplate.canvasColor,
              name: pendingGuestTemplate.name,
              templateId: pendingGuestTemplate.id,
            },
          });
        }}
      />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      <EditTemplateModal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        template={editingTemplate}
        onSave={async (params) => {
          if (!editingTemplate) return;
          await templateStorage.updateTemplate(editingTemplate.id, params);
          queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
        }}
        onDelete={async () => {
          if (!editingTemplate) return;
          await templateStorage.deleteTemplate(editingTemplate.id);
          queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
        }}
      />
      <Footer />
    </div>
  );
};
