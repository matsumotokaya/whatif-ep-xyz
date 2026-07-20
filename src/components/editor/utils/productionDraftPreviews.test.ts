import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Banner } from '../types/template';
import type { ProductionProjectSummary } from '../types/production-project';
import { bannerStorage } from './bannerStorage';
import { renderBannerPreviewAssets } from './bannerPreviewRenderer';
import { generateProductionDraftPreviews } from './productionDraftPreviews';

vi.mock('./bannerStorage', () => ({
  bannerStorage: {
    getById: vi.fn(),
    batchSave: vi.fn(),
  },
}));

vi.mock('./bannerPreviewRenderer', () => ({
  renderBannerPreviewAssets: vi.fn(),
}));

const summaries = [
  {
    linkId: 'link-1',
    bannerId: 'banner-1',
    role: 'portrait_master',
    sortOrder: 1,
    name: 'Portrait',
    thumbnailUrl: null,
    fullresUrl: null,
  },
  {
    linkId: 'link-2',
    bannerId: 'banner-2',
    role: 'landscape_master',
    sortOrder: 2,
    name: 'Landscape',
    thumbnailUrl: null,
    fullresUrl: null,
  },
] satisfies ProductionProjectSummary['banners'];

const banner: Banner = {
  id: 'banner-1',
  name: 'Portrait',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
  template: {
    id: 'portrait',
    name: 'Portrait',
    width: 1440,
    height: 2560,
    backgroundColor: '#808080',
  },
  elements: [],
  canvasColor: '#808080',
};

describe('generateProductionDraftPreviews', () => {
  beforeEach(() => {
    vi.mocked(bannerStorage.getById).mockReset();
    vi.mocked(bannerStorage.batchSave).mockReset();
    vi.mocked(renderBannerPreviewAssets).mockReset();
    vi.mocked(bannerStorage.getById).mockResolvedValue(banner);
    vi.mocked(renderBannerPreviewAssets).mockResolvedValue({
      thumbnailDataURL: 'data:image/jpeg;base64,thumbnail',
      fullresDataURL: 'data:image/jpeg;base64,fullres',
    });
    vi.mocked(bannerStorage.batchSave).mockResolvedValue({
      ...banner,
      thumbnailUrl: 'https://assets.example/thumb.jpg',
      fullresUrl: 'https://assets.example/full.jpg',
      previewStatus: 'ready',
    });
  });

  it('renders and finalizes every generated draft preview', async () => {
    const result = await generateProductionDraftPreviews(summaries);

    expect(result).toEqual({ generatedCount: 2, failures: [] });
    expect(renderBannerPreviewAssets).toHaveBeenCalledTimes(2);
    expect(bannerStorage.batchSave).toHaveBeenCalledTimes(2);
    expect(bannerStorage.batchSave).toHaveBeenCalledWith('banner-1', expect.objectContaining({
      thumbnailDataURL: 'data:image/jpeg;base64,thumbnail',
      fullresDataURL: 'data:image/jpeg;base64,fullres',
    }));
  });

  it('continues with the remaining drafts when one preview fails', async () => {
    vi.mocked(renderBannerPreviewAssets)
      .mockRejectedValueOnce(new Error('image load failed'))
      .mockResolvedValueOnce({
        thumbnailDataURL: 'data:image/jpeg;base64,thumbnail',
        fullresDataURL: 'data:image/jpeg;base64,fullres',
      });

    const result = await generateProductionDraftPreviews(summaries);

    expect(result.generatedCount).toBe(1);
    expect(result.failures).toEqual([
      { bannerId: 'banner-1', name: 'Portrait', message: 'image load failed' },
    ]);
    expect(bannerStorage.batchSave).toHaveBeenCalledTimes(1);
  });
});
