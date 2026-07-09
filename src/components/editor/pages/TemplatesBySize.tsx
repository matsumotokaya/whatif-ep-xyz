import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { UpgradeModal } from '../components/UpgradeModal';
import { EditTemplateModal } from '../components/EditTemplateModal';
import { GuestLimitModal } from '../components/GuestLimitModal';
import { Footer } from '../components/Footer';
import { SortableGrid } from '../components/SortableGrid';
import { LikeButton } from '../components/LikeButton';
import { TemplateWallpaperExporter } from '../components/TemplateWallpaperExporter';
import { useTemplates, templateKeys } from '../hooks/useTemplates';
import { useOpenTemplate } from '../hooks/useOpenTemplate';
import { DEFAULT_TEMPLATES } from '../templates/defaultTemplates';
import type { Template, TemplateRecord } from '../types/template';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from '../lib/router';
import { templateStorage } from '../utils/templateStorage';
import {
  getAspectClass,
  getGridCols,
  resolveSizeCategory,
} from '../utils/sizeCategories';

export const TemplatesBySize = () => {
  const { sizeKey } = useParams<{ sizeKey: string }>();
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
          ) : null}

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
