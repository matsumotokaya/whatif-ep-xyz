import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { GalleryTabs } from '../components/GalleryTabs';
import { UpgradeModal } from '../components/UpgradeModal';
import { EditTemplateModal } from '../components/EditTemplateModal';
import { Footer } from '../components/Footer';
import { SortableGrid } from '../components/SortableGrid';
import { TemplateCard } from '../components/TemplateCard';
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
  getAvailableSizeCategories,
  getGridCols,
} from '../utils/sizeCategories';
import { Link, useNavigate } from '../lib/router';

const MAX_DISPLAY_COUNT = 30;

export const TemplateGallery = () => {
  const { t } = useTranslation(['banner', 'common', 'message', 'auth', 'modal']);
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

  const renderTemplateCard = (template: TemplateRecord) => (
    <TemplateCard
      template={template}
      isAdmin={isAdmin}
      isOpening={templateActionId === template.id}
      isDownloading={templateDownloadId === template.id}
      onOpen={() => handleTemplateClick(template)}
      onWallpaperDownload={() => void handleTemplateWallpaperDownload(template)}
      onEdit={() => setEditingTemplate(template)}
    />
  );

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
