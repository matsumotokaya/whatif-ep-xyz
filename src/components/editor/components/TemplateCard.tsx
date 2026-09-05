'use client';

// The single template card used by every template list (/imagine and the
// size-filtered /imagine/[sizeKey]). Both lists previously carried their own
// near-identical copy of this markup, which is the same defect class that made
// the size-filtered design list silently lose the copy actions: an affordance
// added to one card never reached the other. Any new card affordance belongs
// here, once.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LikeButton } from './LikeButton';
import type { TemplateRecord } from '../types/template';
import { getAspectClass } from '../utils/sizeCategories';

type TemplateCardProps = {
  template: TemplateRecord;
  isAdmin: boolean;
  isOpening: boolean;
  isDownloading: boolean;
  onOpen: () => void;
  onWallpaperDownload: () => void;
  onEdit: () => void;
};

export const TemplateCard = ({
  template,
  isAdmin,
  isOpening,
  isDownloading,
  onOpen,
  onWallpaperDownload,
  onEdit,
}: TemplateCardProps) => {
  const { t } = useTranslation(['banner', 'common', 'modal']);
  const [imageLoading, setImageLoading] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  // Clear any pending "copied" feedback timeout on unmount.
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);
    };
  }, []);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(template.id);
      setIdCopied(true);
      if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = setTimeout(() => setIdCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const aspectClass = getAspectClass(template.width, template.height);

  return (
    <div className="group overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-indigo-400 hover:shadow-lg">
      <div
        className={`${aspectClass} relative cursor-pointer overflow-hidden bg-gray-100`}
        onClick={onOpen}
      >
        {template.thumbnailUrl ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
                  <span className="text-xs text-gray-500">{t('common:status.loading')}</span>
                </div>
              </div>
            )}
            <img
              src={template.thumbnailUrl}
              alt={template.name}
              className="h-full w-full object-cover"
              onLoadStart={() => setImageLoading(true)}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
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
              disabled={isOpening}
            >
              {isOpening ? t('common:status.creating') : t('banner:open')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWallpaperDownload();
              }}
              className="w-28 rounded bg-indigo-600/95 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              disabled={isDownloading}
            >
              {isDownloading ? t('common:status.loading') : t('banner:wallpaperDownload')}
            </button>
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
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
            {/* Always visible, never hover-only: there is no hover on touch, and
                this sits next to the equally always-visible open count. The card
                lives inside a dnd-kit SortableGrid, so the pointerdown has to be
                stopped as well or drag activation swallows the click. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleCopyId();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex shrink-0 items-center rounded p-0.5 transition-colors ${
                idCopied ? 'text-emerald-400' : 'text-white/50 hover:text-white/80'
              }`}
              title={t('banner:copyId')}
            >
              <span className="material-symbols-outlined text-[13px]">
                {idCopied ? 'check' : 'tag'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
