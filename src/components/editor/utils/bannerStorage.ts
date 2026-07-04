import { getSupabase } from './supabase';
import { cacheManager } from './cacheManager';
import type { Banner, BannerListItem, CanvasElement, Template, TemplateRecord } from '../types/template';
import {
  dataUrlToBlob,
  extractStoragePathFromPublicUrl,
  removeFilesFromBucket,
} from './storage';
import { uploadAsset, deleteAssets } from './r2Upload';
import {
  buildBannerThumbKey,
  buildBannerFullKey,
  isAssetKey,
  resolveAsset,
} from '@/lib/asset';

const BANNER_ASSET_BUCKET = 'user-images';

// Result of batchSave: the saved banner (null when nothing was written) plus
// any asset-upload errors. Element/canvasColor data may have persisted fine
// even when an asset upload failed, so these errors are advisory — the caller
// surfaces them (e.g. a partial-failure save status) and relies on the next
// preview-save cycle to retry the failed asset.
export interface BatchSaveResult {
  banner: Banner | null;
  thumbnailError?: unknown;
  fullresError?: unknown;
}

// Resolve a stored banner asset to a public URL: prefer the key column
// (M3 R2 target), fall back to the legacy full-URL column (passthrough). Both
// are cache-busted with the row's updated_at.
const resolveBannerAsset = (
  key: string | null | undefined,
  url: string | null | undefined,
  updatedAt: string,
): string | undefined => {
  const value = key || url;
  if (!value) return undefined;
  return resolveAsset(value, { version: updatedAt, legacyBucket: 'user-images' }) || undefined;
};

interface DbBanner {
  id: string;
  user_id: string;
  name: string;
  template: Template;
  elements: CanvasElement[];
  canvas_color: string;
  thumbnail_url?: string | null;
  fullres_url?: string | null;
  thumbnail_key?: string | null;
  fullres_key?: string | null;
  created_at: string;
  updated_at: string;
}

interface DbBannerListItem {
  id: string;
  name: string;
  thumbnail_url?: string | null;
  fullres_url?: string | null;
  thumbnail_key?: string | null;
  fullres_key?: string | null;
  updated_at: string;
  template?: { width?: number; height?: number } | null;
  display_order?: number | null;
}

// Convert DB format to Banner format
const dbToBanner = (db: DbBanner): Banner => ({
  id: db.id,
  name: db.name,
  template: db.template,
  elements: db.elements,
  canvasColor: db.canvas_color,
  thumbnailUrl: resolveBannerAsset(db.thumbnail_key, db.thumbnail_url, db.updated_at),
  fullresUrl: resolveBannerAsset(db.fullres_key, db.fullres_url, db.updated_at),
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const dbToBannerListItem = (db: DbBannerListItem): BannerListItem => ({
  id: db.id,
  name: db.name,
  thumbnailUrl: resolveBannerAsset(db.thumbnail_key, db.thumbnail_url, db.updated_at),
  fullresUrl: resolveBannerAsset(db.fullres_key, db.fullres_url, db.updated_at),
  updatedAt: db.updated_at,
  width: db.template?.width,
  height: db.template?.height,
  displayOrder: db.display_order ?? undefined,
});

// Collect storage delete targets for a banner from its stored asset columns,
// routing R2 keys and legacy Supabase full URLs to their respective backends.
const collectBannerDeleteTargets = (row: {
  thumbnail_key?: string | null;
  fullres_key?: string | null;
  thumbnail_url?: string | null;
  fullres_url?: string | null;
}): { r2Keys: string[]; supabasePaths: string[] } => {
  const r2Keys: string[] = [];
  const supabasePaths: string[] = [];
  const consider = (key: string | null | undefined, url: string | null | undefined) => {
    if (key && isAssetKey(key)) {
      r2Keys.push(key);
      return;
    }
    const path = extractStoragePathFromPublicUrl(url ?? '', BANNER_ASSET_BUCKET);
    if (path) supabasePaths.push(path);
  };
  consider(row.thumbnail_key, row.thumbnail_url);
  consider(row.fullres_key, row.fullres_url);
  return { r2Keys, supabasePaths };
};

export const bannerStorage = {
  async createFromTemplate(template: TemplateRecord, editorTemplate: Template): Promise<Banner | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Login required');
      return null;
    }

    const elements = JSON.parse(JSON.stringify(template.elements || []));

    const { data, error } = await supabase
      .from('banners')
      .insert({
        user_id: user.id,
        template_id: template.id,
        name: template.name,
        template: editorTemplate,
        elements,
        canvas_color: template.canvasColor,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating banner from template:', error);
      alert('Failed to create banner');
      return null;
    }

    cacheManager.invalidate(`banners:all:${user.id}`);

    return data ? dbToBanner(data) : null;
  },

  // Get all banners (public + own private)
  async getAll(useCache = true): Promise<BannerListItem[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    const cacheKey = user ? `banners:all:${user.id}` : 'banners:public';

    // Check cache first
    if (useCache) {
      const cached = cacheManager.get<Banner[]>(cacheKey);
      if (cached) {
        console.log('✅ Cache hit: banners list');
        return cached;
      }
    }

    // RLS policy handles access control: public banners OR own banners
    const { data, error } = await supabase
      .from('banners')
      .select('id, name, thumbnail_url, fullres_url, thumbnail_key, fullres_key, updated_at, template, display_order')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching banners:', error);
      return [];
    }

    const banners = (data || []).map(dbToBannerListItem);

    // Cache for 5 minutes
    cacheManager.set(cacheKey, banners, 5 * 60 * 1000);

    return banners;
  },

  // Get banner by ID (public or own)
  async getById(id: string, useCache = true): Promise<Banner | null> {
    const supabase = await getSupabase();
    const cacheKey = `banner:${id}`;

    // Check cache first
    if (useCache) {
      const cached = cacheManager.get<Banner>(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit: banner ${id}`);
        return cached;
      }
    }

    // RLS policy handles access control: public banners OR own banners
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching banner:', error);
      return null;
    }

    const banner = data ? dbToBanner(data) : null;

    if (banner) {
      // Cache for 5 minutes
      cacheManager.set(cacheKey, banner, 5 * 60 * 1000);
    }

    return banner;
  },

  // Create new banner
  async create(name: string, template: Template): Promise<Banner | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Login required');
      return null;
    }

    // Create banner with empty elements (no default text)
    const { data, error } = await supabase
      .from('banners')
      .insert({
        user_id: user.id,
        name,
        template,
        elements: [], // Empty array - default elements will be added on client side
        canvas_color: '#FFFFFF',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating banner:', error);
      alert('Failed to create banner');
      return null;
    }

    // Invalidate list cache
    cacheManager.invalidate(`banners:all:${user.id}`);

    return data ? dbToBanner(data) : null;
  },

  // Update banner
  async update(id: string, updates: Partial<Omit<Banner, 'id' | 'createdAt'>>): Promise<Banner | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.template !== undefined) dbUpdates.template = updates.template;
    if (updates.elements !== undefined) dbUpdates.elements = updates.elements;
    if (updates.canvasColor !== undefined) dbUpdates.canvas_color = updates.canvasColor;
    if (updates.thumbnailUrl !== undefined) dbUpdates.thumbnail_url = updates.thumbnailUrl;
    if (updates.fullresUrl !== undefined) dbUpdates.fullres_url = updates.fullresUrl;
    if (updates.thumbnailKey !== undefined) dbUpdates.thumbnail_key = updates.thumbnailKey;
    if (updates.fullresKey !== undefined) dbUpdates.fullres_key = updates.fullresKey;

    const { data, error } = await supabase
      .from('banners')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating banner:', error);
      return null;
    } else {
      // Invalidate cache for this banner and the list
      cacheManager.invalidate(`banner:${id}`);
      cacheManager.invalidate(`banners:all:${user.id}`);
      return data ? dbToBanner(data) : null;
    }
  },

  // Delete banner
  async delete(id: string): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

     const { data: existingBanner } = await supabase
      .from('banners')
      .select('thumbnail_url, fullres_url, thumbnail_key, fullres_key')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting banner:', error);
    } else {
      const { r2Keys, supabasePaths } = collectBannerDeleteTargets(existingBanner ?? {});

      if (r2Keys.length > 0) {
        try {
          await deleteAssets(r2Keys);
        } catch (storageError) {
          console.warn('Failed to remove banner R2 assets:', storageError);
        }
      }
      if (supabasePaths.length > 0) {
        try {
          await removeFilesFromBucket(BANNER_ASSET_BUCKET, supabasePaths);
        } catch (storageError) {
          console.warn('Failed to remove banner assets:', storageError);
        }
      }

      // Invalidate cache
      cacheManager.invalidate(`banner:${id}`);
      cacheManager.invalidate(`banners:all:${user.id}`);
    }
  },

  // Duplicate banner (insert at top of list)
  async duplicate(id: string): Promise<Banner | null> {
    const supabase = await getSupabase();
    const original = await this.getById(id);
    if (!original) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Shift all existing banners' display_order by +1 to make room at position 1
    await supabase.rpc('increment_display_orders', { p_user_id: user.id });

    const { data, error } = await supabase
      .from('banners')
      .insert({
        user_id: user.id,
        name: `${original.name} (Copy)`,
        template: original.template,
        elements: JSON.parse(JSON.stringify(original.elements)),
        canvas_color: original.canvasColor,
        thumbnail_url: null,
        display_order: 1,
      })
      .select()
      .single();

    if (error) {
      console.error('Error duplicating banner:', error);
      return null;
    }

    // Invalidate list cache
    cacheManager.invalidate(`banners:all:${user.id}`);

    return data ? dbToBanner(data) : null;
  },

  // Save elements (for auto-save in editor)
  async saveElements(id: string, elements: CanvasElement[]): Promise<void> {
    await this.update(id, { elements });
  },

  // Save canvas color
  async saveCanvasColor(id: string, canvasColor: string): Promise<void> {
    await this.update(id, { canvasColor });
  },

  // Save thumbnail. Uploads to a deterministic R2 key (overwrite-in-place) and
  // stores the key; the URL is composed at read time via resolveAsset.
  async saveThumbnail(id: string, thumbnailDataURL: string): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { blob, mimeType } = dataUrlToBlob(thumbnailDataURL);
    const key = await uploadAsset(buildBannerThumbKey(user.id, id), blob, mimeType);
    await this.update(id, { thumbnailKey: key });
  },

  // Batch save multiple properties at once (optimized for auto-save). Thumbnail
  // and full-res images upload to deterministic R2 keys (thumb.jpg / full.png)
  // that overwrite in place, so no stale-asset cleanup is needed and only the
  // key columns are persisted.
  //
  // Uploads run first (collecting either their resulting key or their error),
  // then a SINGLE `update()` persists elements/canvasColor plus whichever asset
  // keys succeeded. An asset upload failure is NOT swallowed: it is surfaced in
  // the return value so the caller can reflect a partial-failure state. Because
  // a failed upload leaves its key column untouched, the next save cycle that
  // regenerates the asset naturally retries the persist.
  async batchSave(
    id: string,
    updates: {
      elements?: CanvasElement[];
      canvasColor?: string;
      thumbnailDataURL?: string;
      fullresDataURL?: string;
    }
  ): Promise<BatchSaveResult> {
    // Only update if there are actual changes
    if (Object.keys(updates).length === 0) return { banner: null };

    let nextThumbnailKey: string | undefined;
    let nextFullresKey: string | undefined;
    let thumbnailError: unknown;
    let fullresError: unknown;

    if (updates.thumbnailDataURL || updates.fullresDataURL) {
      const supabase = await getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (updates.thumbnailDataURL) {
          try {
            const { blob, mimeType } = dataUrlToBlob(updates.thumbnailDataURL);
            nextThumbnailKey = await uploadAsset(buildBannerThumbKey(user.id, id), blob, mimeType);
          } catch (error) {
            thumbnailError = error;
            console.error('Failed to upload banner thumbnail asset:', error);
          }
        }

        if (updates.fullresDataURL) {
          try {
            const { blob, mimeType } = dataUrlToBlob(updates.fullresDataURL);
            nextFullresKey = await uploadAsset(buildBannerFullKey(user.id, id), blob, mimeType);
          } catch (error) {
            fullresError = error;
            console.error('Failed to upload banner full-resolution asset:', error);
          }
        }
      }
    }

    // Single DB write. Keys that failed to upload stay `undefined`, so
    // `update()` leaves those columns untouched and they retry next time.
    const banner = await this.update(id, {
      elements: updates.elements,
      canvasColor: updates.canvasColor,
      thumbnailKey: nextThumbnailKey,
      fullresKey: nextFullresKey,
    });

    return { banner, thumbnailError, fullresError };
  },

  // Update banner name
  async updateName(id: string, name: string): Promise<void> {
    await this.update(id, { name });
  },

  // Update display orders for multiple banners
  async updateDisplayOrders(orders: { id: string; displayOrder: number }[]): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update each banner's display_order
    const updates = orders.map(({ id, displayOrder }) =>
      supabase
        .from('banners')
        .update({ display_order: displayOrder })
        .eq('id', id)
        .eq('user_id', user.id)
    );

    await Promise.all(updates);

    // Invalidate cache
    cacheManager.invalidate(`banners:all:${user.id}`);
  },
};
