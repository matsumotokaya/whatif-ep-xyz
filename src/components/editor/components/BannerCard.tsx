'use client';

// The single design card used by every "my designs" list (/mydesign and the
// size-filtered /mydesign/[sizeKey]). Both lists previously carried their own
// near-identical copy of this markup, which is how the size list silently lost
// the ref-URL and design-id copy actions: a button added to one card never
// reached the other. Any new card affordance belongs here, once.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PreviewStatusBadge } from './PreviewStatusBadge';
import type { BannerListItem } from '../types/template';
import { getAspectClass } from '../utils/sizeCategories';
import { downloadImageFromUrl } from '../utils/exportImage';

// NEXT_PUBLIC_* env vars are inlined at build time, safe to read directly in a client component.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://whatif-ep.xyz';

type BannerCardProps = {
  banner: BannerListItem;
  isGuest: boolean;
  isEditingName: boolean;
  editingName: string;
  onEditingNameChange: (value: string) => void;
  onStartEditName: () => void;
  onSaveName: () => void;
  onCancelEditName: () => void;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicateDisabled?: boolean;
  deleteDisabled?: boolean;
};

export const BannerCard = ({
  banner,
  isGuest,
  isEditingName,
  editingName,
  onEditingNameChange,
  onStartEditName,
  onSaveName,
  onCancelEditName,
  onOpen,
  onDuplicate,
  onDelete,
  duplicateDisabled = false,
  deleteDisabled = false,
}: BannerCardProps) => {
  const { t, i18n } = useTranslation(['banner', 'common', 'message']);
  const [imageLoading, setImageLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'id' | 'url' | null>(null);

  // Clear any pending "copied" feedback timeout on unmount.
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);
    };
  }, []);

  const handleCopyToClipboard = async (key: 'id' | 'url', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = setTimeout(() => setCopiedKey(null), 1500);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleDownload = async () => {
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

  const isGuestBanner = isGuest && banner.id === 'guest';
  // Copy feedback has to be visible without hovering: the action overlay is
  // permanently visible on touch, where a hover-only tooltip never appears,
  // so the button also swaps its icon and colour while the flag is up.
  const idCopied = copiedKey === 'id';
  const refUrlCopied = copiedKey === 'url';
  const aspectClass = getAspectClass(banner.width, banner.height);
  const isPreviewGenerating = banner.previewStatus === 'pending' && Boolean(banner.previewRequestedAt);

  return (
    <div className="group bg-white rounded-lg border border-gray-200 hover:border-indigo-400 hover:shadow-lg transition-all overflow-hidden">
      <div
        className={`${aspectClass} bg-gray-100 cursor-pointer relative overflow-hidden`}
        onClick={onOpen}
      >
        <PreviewStatusBadge
          status={banner.previewStatus}
          requestedAt={banner.previewRequestedAt}
          error={banner.previewError}
          className="absolute right-2 top-2 z-10"
        />
        {banner.thumbnailUrl ? (
          <>
            {imageLoading && (
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
              onLoadStart={() => setImageLoading(true)}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
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
          {isEditingName ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveName();
                if (e.key === 'Escape') onCancelEditName();
              }}
              onBlur={() => onSaveName()}
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
                    onStartEditName();
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
          <div className="flex items-center gap-2">
            <p className="text-xs text-white/80">{formatDate(banner.updatedAt)}</p>
            {!isGuestBanner && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCopyToClipboard('id', banner.id);
                }}
                className={`px-1.5 py-0.5 text-xs font-mono rounded transition-colors ${
                  idCopied
                    ? 'bg-emerald-500 text-white'
                    : 'text-white/80 bg-white/10 hover:bg-white/20'
                }`}
                title={t('banner:copyId')}
              >
                {idCopied ? `✓ ${t('banner:copied')}` : banner.id.slice(0, 8)}
              </button>
            )}
          </div>
        </div>

        {/* Action buttons overlay (top right) */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleDownload();
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
                  void handleCopyToClipboard('url', `${SITE_URL}/ref/${banner.id}`);
                }}
                disabled={!banner.fullresUrl}
                className={`w-7 h-7 rounded-md transition-colors flex items-center justify-center group/copyref relative shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  refUrlCopied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/90 hover:bg-white text-gray-700'
                }`}
                title={banner.fullresUrl ? t('banner:copyRefUrl') : t('banner:copyRefUrlUnavailable')}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {refUrlCopied ? 'check' : 'link'}
                </span>
                <span
                  className={`absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded transition-opacity whitespace-nowrap pointer-events-none ${
                    refUrlCopied ? 'opacity-100' : 'opacity-0 group-hover/copyref:opacity-100'
                  }`}
                >
                  {refUrlCopied
                    ? t('banner:copied')
                    : banner.fullresUrl
                      ? t('banner:copyRefUrl')
                      : t('banner:copyRefUrlUnavailable')}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                disabled={duplicateDisabled}
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
                  onDelete();
                }}
                disabled={deleteDisabled}
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
