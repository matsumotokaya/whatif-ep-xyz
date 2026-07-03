import { getSupabase } from './supabase';
import type { CanvasElement, TemplateRecord } from '../types/template';
import { uploadAsset } from './r2Upload';
import { buildTemplateThumbKey, resolveAsset, type AssetKey } from '@/lib/asset';

interface DbTemplate {
  id: string;
  name: string;
  elements?: CanvasElement[] | null;
  canvas_color: string;
  thumbnail_url: string | null;
  thumbnail_key?: string | null;
  plan_type: 'free' | 'premium' | null;
  display_order?: number | null;
  width?: number | null;
  height?: number | null;
  like_count?: number | null;
  open_count?: number | null;
  updated_at?: string | null;
}

// Prefer the key column (M3 R2 target), fall back to the legacy full-URL
// column (passthrough). Template thumbnails live under the default-images
// logical bucket.
const resolveTemplateThumbnail = (db: DbTemplate): string | undefined => {
  const value = db.thumbnail_key || db.thumbnail_url;
  if (!value) return undefined;
  return (
    resolveAsset(value, { version: db.updated_at, legacyBucket: 'default-images' }) || undefined
  );
};

const dbToTemplate = (db: DbTemplate): TemplateRecord => ({
  id: db.id,
  name: db.name,
  elements: db.elements ?? undefined,
  canvasColor: db.canvas_color,
  thumbnailUrl: resolveTemplateThumbnail(db),
  planType: db.plan_type || undefined,
  displayOrder: db.display_order ?? undefined,
  width: db.width ?? undefined,
  height: db.height ?? undefined,
  likeCount: db.like_count ?? 0,
  openCount: db.open_count ?? 0,
});

export const templateStorage = {
  async getPublicTemplates(): Promise<TemplateRecord[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('templates')
      .select('id, name, canvas_color, thumbnail_url, thumbnail_key, plan_type, display_order, width, height, updated_at, like_count, open_count')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return (data || []).map(dbToTemplate);
  },

  async getById(id: string): Promise<TemplateRecord | null> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return null;
    }

    return data ? dbToTemplate(data) : null;
  },

  async createTemplate(params: {
    name: string;
    elements: CanvasElement[];
    canvasColor: string;
    thumbnailKey?: string;
    planType: 'free' | 'premium';
    displayOrder?: number;
    width: number;
    height: number;
  }): Promise<string | null> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('templates')
      .insert({
        name: params.name,
        elements: params.elements,
        canvas_color: params.canvasColor,
        thumbnail_key: params.thumbnailKey || null,
        plan_type: params.planType,
        display_order: params.displayOrder || null,
        width: params.width,
        height: params.height,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating template:', error);
      throw error;
    }

    return data?.id || null;
  },

  // Persist a template's thumbnail key after it has been uploaded to the
  // template's own deterministic R2 key (used by the manual save + Publish
  // paths where the template id is only known after insert/upsert).
  async setTemplateThumbnailKey(id: string, thumbnailKey: string): Promise<void> {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('templates')
      .update({ thumbnail_key: thumbnailKey })
      .eq('id', id);

    if (error) {
      console.error('Error setting template thumbnail key:', error);
      throw error;
    }
  },

  // Promote one of a production project's editable drafts into a public template.
  // The Gallery-linked instagram_feed is promoted as `free` (anyone can open it
  // from the Gallery), while the wallpaper-sized portrait_master/landscape_master
  // drafts are promoted as `premium` (premium members can freely edit them).
  // Keyed on (production_project_id, banner_role) so re-publishing the same
  // project upserts each role's template instead of creating duplicates. The
  // mirrored fields match handleTemplateModalSave in BannerEditor.tsx (manual path).
  async upsertTemplateFromProductionProject(params: {
    productionProjectId: string;
    bannerId: string;
    bannerRole: string;
    name: string;
    planType: 'free' | 'premium';
  }): Promise<string | null> {
    const supabase = await getSupabase();

    // The banner row holds elements/canvas_color directly, while width/height
    // live inside the template jsonb (see bannerStorage.ts dbToBannerListItem).
    const { data: banner, error: bannerError } = await supabase
      .from('banners')
      .select('elements, canvas_color, thumbnail_url, thumbnail_key, updated_at, template')
      .eq('id', params.bannerId)
      .single();

    if (bannerError || !banner) {
      throw bannerError ?? new Error('Failed to load source banner for template promotion.');
    }

    const template = (banner.template ?? {}) as { width?: number; height?: number };
    if (!template.width || !template.height) {
      throw new Error('Source banner is missing canvas width/height for template promotion.');
    }

    const payload = {
      production_project_id: params.productionProjectId,
      production_banner_role: params.bannerRole,
      name: params.name,
      elements: banner.elements,
      canvas_color: banner.canvas_color,
      plan_type: params.planType,
      is_public: true,
      width: template.width,
      height: template.height,
    };

    const { data, error } = await supabase
      .from('templates')
      .upsert(payload, { onConflict: 'production_project_id,production_banner_role' })
      .select('id')
      .single();

    if (error) {
      console.error('Error promoting production project to template:', error);
      throw error;
    }

    const templateId = data?.id || null;

    // Copy the source banner's thumbnail into the template's OWN deterministic
    // key so the template no longer shares an object with the banner (which can
    // be deleted independently). Non-fatal: on failure, fall back to referencing
    // the banner's key directly so the template still renders a thumbnail.
    if (templateId) {
      const sourceThumb = banner.thumbnail_key || banner.thumbnail_url;
      if (sourceThumb) {
        try {
          const sourceUrl = resolveAsset(sourceThumb, {
            version: banner.updated_at,
            legacyBucket: 'user-images',
          });
          const response = await fetch(sourceUrl);
          if (!response.ok) throw new Error(`fetch ${response.status}`);
          const blob = await response.blob();
          const key = await uploadAsset(
            buildTemplateThumbKey(templateId),
            blob,
            blob.type || 'image/jpeg',
          );
          await this.setTemplateThumbnailKey(templateId, key);
        } catch (copyError) {
          console.warn('Failed to copy banner thumbnail to template key:', copyError);
          if (banner.thumbnail_key) {
            try {
              await this.setTemplateThumbnailKey(templateId, banner.thumbnail_key as AssetKey);
            } catch (fallbackError) {
              console.warn('Failed to set fallback template thumbnail key:', fallbackError);
            }
          }
        }
      }
    }

    return templateId;
  },

  async updateTemplate(
    id: string,
    params: {
      name?: string;
      planType?: 'free' | 'premium';
      displayOrder?: number | null;
    }
  ): Promise<void> {
    const supabase = await getSupabase();
    const updates: Record<string, unknown> = {};
    if (params.name !== undefined) updates.name = params.name;
    if (params.planType !== undefined) updates.plan_type = params.planType;
    if (params.displayOrder !== undefined) updates.display_order = params.displayOrder;

    const { error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  },

  async deleteTemplate(id: string): Promise<void> {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  },

  async incrementOpenCount(templateId: string): Promise<void> {
    const supabase = await getSupabase();
    await supabase.rpc('increment_template_open_count', {
      template_id: templateId,
    });
  },

  async updateDisplayOrders(
    orders: { id: string; displayOrder: number }[]
  ): Promise<void> {
    const supabase = await getSupabase();
    // Update each template's display_order
    const promises = orders.map(({ id, displayOrder }) =>
      supabase
        .from('templates')
        .update({ display_order: displayOrder })
        .eq('id', id)
    );

    const results = await Promise.all(promises);
    const errors = results.filter((r) => r.error);

    if (errors.length > 0) {
      console.error('Error updating display orders:', errors);
      throw new Error('Failed to update display orders');
    }
  },
};
