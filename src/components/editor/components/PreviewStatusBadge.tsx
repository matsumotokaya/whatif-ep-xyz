'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';
import type { Banner } from '../types/template';

type PreviewStatusBadgeProps = {
  status?: Banner['previewStatus'];
  requestedAt?: string | null;
  error?: string | null;
  className?: string;
};

export function PreviewStatusBadge({ status, requestedAt, error, className }: PreviewStatusBadgeProps) {
  const { t } = useTranslation('common');

  if (!status || status === 'ready' || (status === 'pending' && !requestedAt)) return null;

  const failed = status === 'failed';
  return (
    <span
      role="status"
      title={failed && error ? error : undefined}
      className={cn(
        'inline-flex rounded-full px-2 py-1 text-xs font-medium shadow-sm',
        failed ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900',
        className,
      )}
    >
      {failed ? t('thumbnail.failed') : t('thumbnail.updating')}
    </span>
  );
}
