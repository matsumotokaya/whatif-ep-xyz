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
  createAssetRevision,
  buildBannerThumbKey,
  buildBannerFullKey,
  isAssetKey,
  resolveAsset,
} from '@/lib/asset';
import { createBannerSaveTrace, getSaveErrorCode } from './bannerSaveTelemetry';

const BANNER_ASSET_BUCKET = 'user-images';

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
  preview_status?: Banner['previewStatus'];
  preview_source?: Banner['previewSource'];
  preview_error?: string | null;
  document_revision?: number;
  preview_revision?: number;
  preview_requested_at?: string | null;
  preview_completed_at?: string | null;
}

interface DbBannerListItem {
  id: string;
  name: string;
  thumbnail_url?: string | null;
  fullres_url?: string | null;
  thumbnail_key?: string | null;
  fullres_key?: string | null;
  created_at?: string;
  updated_at: string;
  template?: { width?: number; height?: number; thumbnail?: string | null } | null;
  display_order?: number | null;
  preview_status?: Banner['previewStatus'];
  preview_source?: Banner['previewSource'];
  preview_error?: string | null;
  document_revision?: number;
  preview_revision?: number;
  preview_requested_at?: string | null;
  preview_completed_at?: string | null;
}

type BannerUpdatePayload = {
  name?: Banner['name'];
  template?: Banner['template'];
  elements?: Banner['elements'];
  canvas_color?: Banner['canvasColor'];
  thumbnail_url?: Banner['thumbnailUrl'];
  fullres_url?: Banner['fullresUrl'];
  thumbnail_key?: Banner['thumbnailKey'];
  fullres_key?: Banner['fullresKey'];
};

const derivePreviewStatus = (db: {
  thumbnail_key?: string | null;
  thumbnail_url?: string | null;
  template?: { thumbnail?: string | null } | null;
}): Banner['previewStatus'] => {
  if (db.thumbnail_key || db.thumbnail_url) return 'ready';
  return 'pending';
};

const derivePreviewSource = (db: {
  thumbnail_key?: string | null;
  thumbnail_url?: string | null;
  template?: { thumbnail?: string | null } | null;
}): Banner['previewSource'] => {
  if (db.thumbnail_key || db.thumbnail_url) return 'generated';
  return 'none';
};

const resolveBannerThumbnail = (db: {
  thumbnail_key?: string | null;
  thumbnail_url?: string | null;
  updated_at: string;
  template?: { thumbnail?: string | null } | null;
}): string | undefined => {
  return resolveBannerAsset(db.thumbnail_key, db.thumbnail_url, db.updated_at);
};

// Convert DB format to Banner format
const dbToBanner = (db: DbBanner): Banner => ({
  id: db.id,
  name: db.name,
  template: db.template,
  elements: db.elements,
  canvasColor: db.canvas_color,
  thumbnailUrl: resolveBannerThumbnail(db),
  fullresUrl: resolveBannerAsset(db.fullres_key, db.fullres_url, db.updated_at),
  createdAt: db.created_at,
  updatedAt: db.updated_at,
  previewStatus: db.preview_status ?? derivePreviewStatus(db),
  previewSource: db.preview_source ?? derivePreviewSource(db),
  previewError: db.preview_error ?? null,
  documentRevision: db.document_revision,
  previewRevision: db.preview_revision,
  previewRequestedAt: db.preview_requested_at,
  previewCompletedAt: db.preview_completed_at,
});

const dbToBannerListItem = (db: DbBannerListItem): BannerListItem => ({
  id: db.id,
  name: db.name,
  thumbnailUrl: resolveBannerThumbnail(db),
  fullresUrl: resolveBannerAsset(db.fullres_key, db.fullres_url, db.updated_at),
  updatedAt: db.updated_at,
  width: db.template?.width,
  height: db.template?.height,
  displayOrder: db.display_order ?? undefined,
  previewStatus: db.preview_status ?? derivePreviewStatus(db),
  previewSource: db.preview_source ?? derivePreviewSource(db),
  previewError: db.preview_error ?? null,
  documentRevision: db.document_revision,
  previewRevision: db.preview_revision,
  previewRequestedAt: db.preview_requested_at,
  previewCompletedAt: db.preview_completed_at,
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

const collectReplacedBannerAssetTargets = (
  previous: { key?: string | null; url?: string | null },
  nextKey: string,
): { r2Keys: string[]; supabasePaths: string[] } => {
  const r2Keys: string[] = [];
  const supabasePaths: string[] = [];

  if (previous.key && isAssetKey(previous.key)) {
    if (previous.key !== nextKey) {
      r2Keys.push(previous.key);
    }
    return { r2Keys, supabasePaths };
  }

  const path = extractStoragePathFromPublicUrl(previous.url ?? '', BANNER_ASSET_BUCKET);
  if (path) {
    supabasePaths.push(path);
  }

  return { r2Keys, supabasePaths };
};

type BatchSaveUpdates = {
  elements?: CanvasElement[];
  canvasColor?: string;
  thumbnailDataURL?: string;
  fullresDataURL?: string;
};

const REVISION_RPC_MISSING_CODES = new Set(['PGRST202', '42883']);
const PREVIEW_METADATA_MISSING_CODES = new Set(['42703', 'PGRST204']);

const isRevisionRpcMissing = (error: unknown): boolean =>
  Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && typeof error.code === 'string'
      && REVISION_RPC_MISSING_CODES.has(error.code),
  );

const isPreviewMetadataMissing = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return PREVIEW_METADATA_MISSING_CODES.has(code)
    && /preview_(status|source|error|revision|requested_at|completed_at)|document_revision/i.test(message);
};

const toPreviewErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message.slice(0, 1000);
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message.slice(0, 1000);
  }
  return 'Preview generation failed.';
};

async function removeUploadedPreviewAssets(keys: string[], context: string): Promise<void> {
  if (keys.length === 0) return;
  try {
    await deleteAssets(keys);
  } catch (cleanupError) {
    console.warn(context, cleanupError);
  }
}

async function removeReplacedPreviewAssets(
  previous: Pick<DbBanner, 'thumbnail_key' | 'thumbnail_url' | 'fullres_key' | 'fullres_url'>,
  nextThumbnailKey?: string,
  nextFullresKey?: string,
): Promise<void> {
  const replacedTargets = [
    nextThumbnailKey
      ? collectReplacedBannerAssetTargets(
          { key: previous.thumbnail_key, url: previous.thumbnail_url },
          nextThumbnailKey,
        )
      : null,
    nextFullresKey
      ? collectReplacedBannerAssetTargets(
          { key: previous.fullres_key, url: previous.fullres_url },
          nextFullresKey,
        )
      : null,
  ].filter((targets): targets is { r2Keys: string[]; supabasePaths: string[] } => targets !== null);

  const staleR2Keys = replacedTargets.flatMap((targets) => targets.r2Keys);
  const staleSupabasePaths = replacedTargets.flatMap((targets) => targets.supabasePaths);
  await Promise.all([
    staleR2Keys.length > 0
      ? deleteAssets(staleR2Keys).catch((storageError) => {
          console.warn('Failed to remove stale banner preview R2 assets:', storageError);
        })
      : Promise.resolve(),
    staleSupabasePaths.length > 0
      ? removeFilesFromBucket(BANNER_ASSET_BUCKET, staleSupabasePaths).catch((storageError) => {
          console.warn('Failed to remove stale banner preview Supabase assets:', storageError);
        })
      : Promise.resolve(),
  ]);
}

async function clonePreviewAssetsForDuplicate(params: {
  userId: string;
  bannerId: string;
  thumbnailUrl?: string;
  fullresUrl?: string;
}): Promise<{ thumbnailKey?: string; fullresKey?: string }> {
  const requests: Array<{
    kind: 'thumbnail' | 'fullres';
    sourceUrl: string;
    destinationKey: ReturnType<typeof buildBannerThumbKey> | ReturnType<typeof buildBannerFullKey>;
  }> = [];

  if (params.thumbnailUrl) {
    requests.push({
      kind: 'thumbnail',
      sourceUrl: params.thumbnailUrl,
      destinationKey: buildBannerThumbKey(params.userId, params.bannerId, createAssetRevision()),
    });
  }

  if (params.fullresUrl) {
    requests.push({
      kind: 'fullres',
      sourceUrl: params.fullresUrl,
      destinationKey: buildBannerFullKey(params.userId, params.bannerId, createAssetRevision()),
    });
  }

  if (requests.length === 0) {
    return {};
  }

  const uploadedKeys: string[] = [];
  const results = await Promise.allSettled(
    requests.map(async (request) => {
      const response = await fetch(request.sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to clone ${request.kind} preview (${response.status})`);
      }

      const blob = await response.blob();
      const contentType = blob.type || response.headers.get('content-type') || 'image/jpeg';
      const uploadedKey = await uploadAsset(request.destinationKey, blob, contentType);
      uploadedKeys.push(uploadedKey);
      return { kind: request.kind, key: uploadedKey };
    }),
  );

  const failedResult = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (failedResult) {
    await removeUploadedPreviewAssets(
      uploadedKeys,
      'Failed to remove duplicated preview assets after clone failure:',
    );
    throw failedResult.reason;
  }

  return results.reduce<{ thumbnailKey?: string; fullresKey?: string }>((acc, result) => {
    if (result.status !== 'fulfilled') return acc;
    if (result.value.kind === 'thumbnail') acc.thumbnailKey = result.value.key;
    if (result.value.kind === 'fullres') acc.fullresKey = result.value.key;
    return acc;
  }, {});
}

// Temporary rollout path. It keeps local/prod saves working while the revision
// migration and PostgREST schema cache are being deployed. Remove after the
// revision RPCs have been verified in production.
async function legacyBatchSave(id: string, updates: BatchSaveUpdates): Promise<Banner | null> {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required to save a design.');
  }

  const hasPreview = Boolean(updates.thumbnailDataURL || updates.fullresDataURL);
  let existingAssets: Pick<DbBanner, 'thumbnail_key' | 'thumbnail_url' | 'fullres_key' | 'fullres_url'> = {};
  if (hasPreview) {
    const { data, error } = await supabase
      .from('banners')
      .select('thumbnail_key, thumbnail_url, fullres_key, fullres_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (error) throw error;
    existingAssets = data;
  }

  type PreviewKind = 'thumbnail' | 'fullres';
  const uploadRequests: Array<{
    kind: PreviewKind;
    key: ReturnType<typeof buildBannerThumbKey>;
    blob: Blob;
    mimeType: string;
  }> = [];

  if (updates.thumbnailDataURL) {
    const { blob, mimeType } = dataUrlToBlob(updates.thumbnailDataURL);
    uploadRequests.push({
      kind: 'thumbnail',
      key: buildBannerThumbKey(user.id, id, createAssetRevision()),
      blob,
      mimeType,
    });
  }
  if (updates.fullresDataURL) {
    const { blob, mimeType } = dataUrlToBlob(updates.fullresDataURL);
    uploadRequests.push({
      kind: 'fullres',
      key: buildBannerFullKey(user.id, id, createAssetRevision()),
      blob,
      mimeType,
    });
  }

  const uploadResults = await Promise.allSettled(
    uploadRequests.map(async (request) => ({
      kind: request.kind,
      key: await uploadAsset(request.key, request.blob, request.mimeType),
    })),
  );
  const uploaded = uploadResults.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const failedUpload = uploadResults.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failedUpload) {
    await removeUploadedPreviewAssets(
      uploaded.map((asset) => asset.key),
      'Failed to remove legacy preview assets after an upload failure:',
    );
    throw failedUpload.reason;
  }

  const nextThumbnailKey = uploaded.find((asset) => asset.kind === 'thumbnail')?.key;
  const nextFullresKey = uploaded.find((asset) => asset.kind === 'fullres')?.key;
  const dbUpdates: BannerUpdatePayload = {};
  if (updates.elements !== undefined) dbUpdates.elements = updates.elements;
  if (updates.canvasColor !== undefined) dbUpdates.canvas_color = updates.canvasColor;
  if (nextThumbnailKey !== undefined) dbUpdates.thumbnail_key = nextThumbnailKey;
  if (nextFullresKey !== undefined) dbUpdates.fullres_key = nextFullresKey;

  const { data: saved, error: saveError } = await supabase
    .from('banners')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single();
  if (saveError) {
    await removeUploadedPreviewAssets(
      uploaded.map((asset) => asset.key),
      'Failed to remove orphaned legacy preview assets:',
    );
    throw saveError;
  }

  await removeReplacedPreviewAssets(existingAssets, nextThumbnailKey, nextFullresKey);
  cacheManager.invalidate(`banner:${id}`);
  cacheManager.invalidate(`banners:all:${user.id}`);
  return saved ? dbToBanner(saved) : null;
}

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
        thumbnail_url: editorTemplate.thumbnail ?? template.thumbnailUrl ?? null,
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
    const selectBannerList = (columns: string) => supabase
      .from('banners')
      .select(columns)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    const previewColumns =
      'id, name, thumbnail_url, fullres_url, thumbnail_key, fullres_key, created_at, updated_at, template, display_order, preview_status, preview_source, preview_error, document_revision, preview_revision, preview_requested_at, preview_completed_at';
    const legacyColumns =
      'id, name, thumbnail_url, fullres_url, thumbnail_key, fullres_key, created_at, updated_at, template, display_order';
    let { data, error } = await selectBannerList(previewColumns);

    if (isPreviewMetadataMissing(error)) {
      ({ data, error } = await selectBannerList(legacyColumns));
    }

    if (error) {
      console.error('Error fetching banners:', error);
      return [];
    }

    const banners = ((data || []) as unknown as DbBannerListItem[]).map(dbToBannerListItem);

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
      .maybeSingle();

    if (error) {
      console.error('Error fetching banner:', error);
      throw error;
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
    if (!user) {
      throw new Error('Authentication required to update a design.');
    }

    const hasDocumentUpdate =
      updates.template !== undefined
      || updates.elements !== undefined
      || updates.canvasColor !== undefined;
    const hasNonDocumentUpdate =
      updates.name !== undefined
      || updates.thumbnailUrl !== undefined
      || updates.fullresUrl !== undefined
      || updates.thumbnailKey !== undefined
      || updates.fullresKey !== undefined;

    if (hasDocumentUpdate && !hasNonDocumentUpdate) {
      const revisionResult = await supabase
        .rpc('save_banner_document', {
          p_banner_id: id,
          p_elements: updates.elements ?? null,
          p_canvas_color: updates.canvasColor ?? null,
          p_template: updates.template ?? null,
        })
        .maybeSingle();

      if (!revisionResult.error && revisionResult.data) {
        cacheManager.invalidate(`banner:${id}`);
        cacheManager.invalidate(`banners:all:${user.id}`);
        return dbToBanner(revisionResult.data as DbBanner);
      }
      if (revisionResult.error && !isRevisionRpcMissing(revisionResult.error)) {
        throw revisionResult.error;
      }
      // The migration may be rolling out separately from the application.
      // Fall through to the legacy update only when PostgREST cannot find the
      // new RPC; all other failures stay visible.
    }

    const dbUpdates: BannerUpdatePayload = {};
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
      throw error;
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

    const duplicatedId = crypto.randomUUID();
    const duplicatedTemplate = { ...original.template };
    delete duplicatedTemplate.thumbnail;

    // Shift all existing banners' display_order by +1 to make room at position 1
    await supabase.rpc('increment_display_orders', { p_user_id: user.id });

    let duplicatedPreviewKeys: { thumbnailKey?: string; fullresKey?: string } = {};
    try {
      duplicatedPreviewKeys = await clonePreviewAssetsForDuplicate({
        userId: user.id,
        bannerId: duplicatedId,
        thumbnailUrl: original.thumbnailUrl,
        fullresUrl: original.fullresUrl,
      });
    } catch (error) {
      console.warn('Failed to clone duplicated banner preview assets:', error);
    }

    const { data, error } = await supabase
      .from('banners')
      .insert({
        id: duplicatedId,
        user_id: user.id,
        name: `${original.name} (Copy)`,
        template: duplicatedTemplate,
        elements: JSON.parse(JSON.stringify(original.elements)),
        canvas_color: original.canvasColor,
        thumbnail_url: null,
        fullres_url: null,
        thumbnail_key: duplicatedPreviewKeys.thumbnailKey ?? null,
        fullres_key: duplicatedPreviewKeys.fullresKey ?? null,
        display_order: 1,
      })
      .select()
      .single();

    if (error) {
      await removeUploadedPreviewAssets(
        [duplicatedPreviewKeys.thumbnailKey, duplicatedPreviewKeys.fullresKey].filter(Boolean) as string[],
        'Failed to remove duplicated preview assets after banner insert failure:',
      );
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

  // Save thumbnail. Uploads to a fresh immutable R2 key and stores the key;
  // the URL is composed at read time via resolveAsset.
  async saveThumbnail(id: string, thumbnailDataURL: string): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase
      .from('banners')
      .select('thumbnail_key, thumbnail_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    const { blob, mimeType } = dataUrlToBlob(thumbnailDataURL);
    const key = await uploadAsset(
      buildBannerThumbKey(user.id, id, createAssetRevision()),
      blob,
      mimeType,
    );
    await this.update(id, { thumbnailKey: key });

    const staleTargets = collectReplacedBannerAssetTargets(
      {
        key: existing?.thumbnail_key,
        url: existing?.thumbnail_url,
      },
      key,
    );
    if (staleTargets.r2Keys.length > 0) {
      try {
        await deleteAssets(staleTargets.r2Keys);
      } catch (storageError) {
        console.warn('Failed to remove stale banner thumbnail R2 assets:', storageError);
      }
    }
    if (staleTargets.supabasePaths.length > 0) {
      try {
        await removeFilesFromBucket(BANNER_ASSET_BUCKET, staleTargets.supabasePaths);
      } catch (storageError) {
        console.warn('Failed to remove stale banner thumbnail Supabase assets:', storageError);
      }
    }
  },

  // Batch save multiple properties at once (optimized for auto-save). Preview
  // assets upload to immutable keys so the DB row becomes the source of truth
  // for "which preview is current", instead of caches needing overwrite
  // invalidation semantics.
  async batchSave(
    id: string,
    updates: BatchSaveUpdates,
  ): Promise<Banner | null> {
    if (Object.keys(updates).length === 0) return null;
    const trace = createBannerSaveTrace({
      bannerId: id,
      elementCount: updates.elements?.length,
      thumbnailBytes: updates.thumbnailDataURL?.length,
      fullresBytes: updates.fullresDataURL?.length,
    });
    trace.emit('save_started', 'started');

    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required to save a design.');
    }

    // Commit the canonical document first. The returned monotonic revision is
    // the only revision a derived preview is allowed to finalize against.
    const documentResult = await supabase
      .rpc('save_banner_document', {
        p_banner_id: id,
        p_elements: updates.elements ?? null,
        p_canvas_color: updates.canvasColor ?? null,
        p_template: null,
      })
      .maybeSingle();

    if (documentResult.error) {
      if (isRevisionRpcMissing(documentResult.error)) {
        trace.emit('legacy_fallback', 'fallback', {
          errorCode: getSaveErrorCode(documentResult.error),
        });
        const legacyResult = await legacyBatchSave(id, updates);
        trace.emit('save_completed', 'succeeded');
        return legacyResult;
      }
      trace.emit('save_completed', 'failed', {
        errorCode: getSaveErrorCode(documentResult.error),
      });
      throw documentResult.error;
    }

    if (!documentResult.data) {
      const notFoundError = new Error('The design could not be saved or is no longer accessible.');
      trace.emit('save_completed', 'failed', { errorCode: 'banner_not_found' });
      throw notFoundError;
    }

    const documentRow = documentResult.data as DbBanner;
    const documentBanner = dbToBanner(documentRow);
    const documentRevision = documentRow.document_revision;
    if (!documentRevision) {
      const revisionError = new Error('The saved design did not return a document revision.');
      trace.emit('save_completed', 'failed', { errorCode: 'missing_document_revision' });
      throw revisionError;
    }
    trace.emit('document_committed', 'succeeded', { documentRevision });

    const hasPreview = Boolean(updates.thumbnailDataURL || updates.fullresDataURL);
    if (!hasPreview) {
      cacheManager.invalidate(`banner:${id}`);
      cacheManager.invalidate(`banners:all:${user.id}`);
      trace.emit('save_completed', 'succeeded', { documentRevision });
      return documentBanner;
    }

    const markPreviewFailed = async (error: unknown): Promise<Banner> => {
      const message = toPreviewErrorMessage(error);
      const failureResult = await supabase
        .rpc('fail_banner_preview', {
          p_banner_id: id,
          p_document_revision: documentRevision,
          p_error: message,
        })
        .maybeSingle();

      if (failureResult.error) {
        console.warn('Failed to persist banner preview failure state:', failureResult.error);
      }
      const failedBanner = failureResult.data
        ? dbToBanner(failureResult.data as DbBanner)
        : {
            ...documentBanner,
            previewStatus: 'failed' as const,
            previewError: message,
          };
      cacheManager.invalidate(`banner:${id}`);
      cacheManager.invalidate(`banners:all:${user.id}`);
      trace.emit('preview_failed', 'failed', {
        documentRevision,
        errorCode: getSaveErrorCode(error),
      });
      trace.emit('save_completed', 'succeeded', { documentRevision });
      return failedBanner;
    };

    type PreviewKind = 'thumbnail' | 'fullres';
    const uploadRequests: Array<{
      kind: PreviewKind;
      key: ReturnType<typeof buildBannerThumbKey>;
      blob: Blob;
      mimeType: string;
    }> = [];
    const assetRevision = `${documentRevision}-${createAssetRevision()}`;

    if (updates.thumbnailDataURL) {
      const { blob, mimeType } = dataUrlToBlob(updates.thumbnailDataURL);
      uploadRequests.push({
        kind: 'thumbnail',
        key: buildBannerThumbKey(user.id, id, assetRevision),
        blob,
        mimeType,
      });
    }
    if (updates.fullresDataURL) {
      const { blob, mimeType } = dataUrlToBlob(updates.fullresDataURL);
      uploadRequests.push({
        kind: 'fullres',
        key: buildBannerFullKey(user.id, id, assetRevision),
        blob,
        mimeType,
      });
    }

    trace.emit('preview_upload_started', 'started', { documentRevision });
    const uploadResults = await Promise.allSettled(
      uploadRequests.map(async (request) => ({
        kind: request.kind,
        key: await uploadAsset(request.key, request.blob, request.mimeType),
      })),
    );
    const uploaded = uploadResults.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const failedUpload = uploadResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (failedUpload) {
      await removeUploadedPreviewAssets(
        uploaded.map((asset) => asset.key),
        'Failed to remove preview assets after an upload failure:',
      );
      return markPreviewFailed(failedUpload.reason);
    }

    trace.emit('preview_upload_completed', 'succeeded', { documentRevision });
    const nextThumbnailKey = uploaded.find((asset) => asset.kind === 'thumbnail')?.key;
    const nextFullresKey = uploaded.find((asset) => asset.kind === 'fullres')?.key;
    const finalizeResult = await supabase
      .rpc('finalize_banner_preview', {
        p_banner_id: id,
        p_document_revision: documentRevision,
        p_thumbnail_key: nextThumbnailKey ?? null,
        p_fullres_key: nextFullresKey ?? null,
      })
      .maybeSingle();

    if (finalizeResult.error) {
      await removeUploadedPreviewAssets(
        uploaded.map((asset) => asset.key),
        'Failed to remove preview assets after a finalize failure:',
      );
      return markPreviewFailed(finalizeResult.error);
    }

    // A zero-row result means a newer document revision won the race. The
    // uploaded immutable files are not current and must never replace it.
    if (!finalizeResult.data) {
      await removeUploadedPreviewAssets(
        uploaded.map((asset) => asset.key),
        'Failed to remove stale revision preview assets:',
      );
      trace.emit('preview_rejected_as_stale', 'stale', { documentRevision });
      const currentBanner = await this.getById(id, false);
      trace.emit('save_completed', 'stale', { documentRevision });
      return currentBanner ?? documentBanner;
    }

    const finalizedRow = finalizeResult.data as DbBanner;
    await removeReplacedPreviewAssets(documentRow, nextThumbnailKey, nextFullresKey);
    cacheManager.invalidate(`banner:${id}`);
    cacheManager.invalidate(`banners:all:${user.id}`);
    trace.emit('preview_finalized', 'succeeded', { documentRevision });
    trace.emit('save_completed', 'succeeded', { documentRevision });
    return dbToBanner(finalizedRow);
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
