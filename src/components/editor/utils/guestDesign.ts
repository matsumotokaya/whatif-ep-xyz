import type { BannerListItem, TemplateRecord } from '../types/template';

export const GUEST_STORAGE_KEY = 'banalist_guest_banner';

interface GuestBannerSnapshot {
  name?: string;
  template?: {
    id?: string;
    name?: string;
    width?: number;
    height?: number;
  };
  updatedAt?: string;
  createdAt?: string;
  thumbnailUrl?: string;
  fullresUrl?: string;
}

export const isPremiumTemplate = (template: Pick<TemplateRecord, 'planType'>) =>
  (template.planType || 'free') === 'premium';

export const readGuestBannerSnapshot = (): GuestBannerSnapshot | null => {
  try {
    const stored = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as GuestBannerSnapshot;
  } catch {
    return null;
  }
};

// Guest's single localStorage design shaped like a saved-banner list row, for
// the /mydesign list pages. Returns null when absent or unparsable.
export const readGuestBannerListItem = (): BannerListItem | null => {
  const parsed = readGuestBannerSnapshot();
  if (!parsed) return null;
  return {
    id: 'guest',
    name: parsed.name || parsed.template?.name || 'Guest Banner',
    updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
    thumbnailUrl: parsed.thumbnailUrl,
    fullresUrl: parsed.fullresUrl,
    width: parsed.template?.width,
    height: parsed.template?.height,
  };
};

export const hasGuestDesignConflict = (templateId: string): boolean => {
  const snapshot = readGuestBannerSnapshot();
  const currentTemplateId = snapshot?.template?.id;
  return Boolean(currentTemplateId && currentTemplateId !== templateId);
};
