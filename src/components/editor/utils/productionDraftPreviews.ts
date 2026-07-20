import type { ProductionProjectSummary } from '../types/production-project';
import { bannerStorage } from './bannerStorage';

export interface ProductionDraftPreviewResult {
  generatedCount: number;
  failures: Array<{ bannerId: string; name: string; message: string }>;
}

export async function generateProductionDraftPreviews(
  banners: ProductionProjectSummary['banners'],
): Promise<ProductionDraftPreviewResult> {
  const result: ProductionDraftPreviewResult = { generatedCount: 0, failures: [] };
  const { renderBannerPreviewAssets } = await import('./bannerPreviewRenderer');

  // Process one full-size canvas at a time. Portrait and landscape drafts are
  // several megapixels each, so sequential rendering avoids a large transient
  // memory spike on the Content Factory page.
  for (const summary of banners) {
    try {
      const banner = await bannerStorage.getById(summary.bannerId, false);
      if (!banner) {
        throw new Error('The generated draft could not be loaded.');
      }

      const previews = await renderBannerPreviewAssets(banner);
      const saved = await bannerStorage.batchSave(summary.bannerId, {
        elements: banner.elements,
        canvasColor: banner.canvasColor,
        thumbnailDataURL: previews.thumbnailDataURL,
        fullresDataURL: previews.fullresDataURL,
      });
      if (!saved || saved.previewStatus !== 'ready' || !saved.thumbnailUrl || !saved.fullresUrl) {
        throw new Error(saved?.previewError || 'The generated preview could not be finalized.');
      }
      result.generatedCount += 1;
    } catch (error) {
      result.failures.push({
        bannerId: summary.bannerId,
        name: summary.name,
        message: error instanceof Error ? error.message : 'Unknown preview generation error.',
      });
    }
  }

  return result;
}
