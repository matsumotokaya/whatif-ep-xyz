import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { UpgradeModal } from '../components/UpgradeModal';
import { EditTemplateModal } from '../components/EditTemplateModal';
import { GuestLimitModal } from '../components/GuestLimitModal';
import { Footer } from '../components/Footer';
import { SortableGrid } from '../components/SortableGrid';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateWallpaperExporter } from '../components/TemplateWallpaperExporter';
import { useTemplates, templateKeys } from '../hooks/useTemplates';
import { useOpenTemplate } from '../hooks/useOpenTemplate';
import { DEFAULT_TEMPLATES } from '../templates/defaultTemplates';
import type { Template, TemplateRecord } from '../types/template';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from '../lib/router';
import { templateStorage } from '../utils/templateStorage';
import { getGridCols, resolveSizeCategory } from '../utils/sizeCategories';

export const TemplatesBySize = () => {
  const { sizeKey } = useParams<{ sizeKey: string }>();
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
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const category = resolveSizeCategory(sizeKey, templates);
  const filteredTemplates = category
    ? templates.filter(
        (template) =>
          template.width === category.width && template.height === category.height
      )
    : [];

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
      navigate(`/auth/login?next=${encodeURIComponent(`/imagine/${sizeKey ?? ''}`)}`),
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

  if (!category) {
    return (
      <div className="min-h-screen bg-[#101010]">
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-8">
          <div className="py-20 text-center">
            <h2 className="mb-4 text-xl font-semibold text-gray-100">
              {t('banner:categoryNotFound')}
            </h2>
            <button
              onClick={() => navigate('/imagine')}
              className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
            >
              {t('banner:backToTemplates')}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const gridCols = getGridCols(category.width, category.height);

  return (
    <div className="min-h-screen bg-[#101010]">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-gray-400">
            <li>
              <button
                onClick={() => navigate('/imagine')}
                className="transition-colors hover:text-indigo-400"
              >
                {t('banner:templatesTitle')}
              </button>
            </li>
            <li>/</li>
            <li className="text-gray-100">{category.label}</li>
          </ol>
        </nav>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-100">
            {category.label}
            <span className="text-sm font-normal text-gray-400">
              ({category.width}×{category.height})
            </span>
            <span className="text-sm font-normal text-gray-500">
              — {t('common:items', { count: filteredTemplates.length })}
            </span>
          </h2>
        </div>

        {templatesLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
            <p className="mt-4 text-gray-600">{t('common:status.loading')}</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-700">
              <svg
                className="h-8 w-8 text-gray-400"
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
            <h3 className="mb-2 text-lg font-medium text-gray-300">
              {t('banner:noTemplatesForSize')}
            </h3>
          </div>
        ) : (
          <SortableGrid
            items={filteredTemplates}
            disabled={!isAdmin}
            gridClassName={`grid ${gridCols} gap-4`}
            onReorder={handleReorderTemplates}
            renderItem={renderTemplateCard}
          />
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
