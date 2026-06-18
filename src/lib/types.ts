export interface Episode {
  id: number;
  number: string; // "0001" format
  title: string;
  category: string;
  hasOriginalPng: boolean;
  hasThumbnailJpg: boolean;
  productUrl: string | null;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  originalStorageKey: string;
  thumbnailStorageKey: string | null;
  isPublished: boolean;
  publishedAt: string | null;
}

export interface EpisodesData {
  episodes: Episode[];
  total: number;
  lastUpdated: string;
}

export interface EpisodeRow {
  id: number;
  number: string;
  title: string;
  category: string;
  product_url: string | null;
  released_on: string | null;
  original_storage_key: string;
  thumbnail_storage_key: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type GallerySeriesSlug =
  | "episode"
  | "reel"
  | "experiment"
  | "remix";

export type WorkStatus = "draft" | "published" | "archived";
export type WorkVariantStatus = "ready" | "preparing" | "hidden";
export type WorkVariantType = "image" | "scene" | "angle" | "edit";
export type WorkOfferType =
  | "wallpaper"
  | "imagine_starter"
  | "imagine_template"
  | "store_product";
export type WorkOfferPlanType = "public" | "free" | "premium" | "paid";
export type WorkOfferStatus = "ready" | "preparing" | "requested" | "hidden";

export interface GallerySeries {
  id: string;
  slug: string;
  name: string;
  routeBase: string;
  numberPadding: number;
  sortOrder: number;
  isPublic: boolean;
  workCount: number;
}

export interface WorkOffer {
  id: string;
  workId: string;
  variantId: string | null;
  offerType: WorkOfferType;
  planType: WorkOfferPlanType;
  status: WorkOfferStatus;
  title: string | null;
  description: string | null;
  targetRef: string | null;
  targetUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkVariant {
  id: string;
  workId: string;
  variantNumber: number;
  displayCode: string;
  title: string | null;
  caption: string | null;
  variantType: WorkVariantType;
  originalStorageKey: string | null;
  thumbnailStorageKey: string | null;
  width: number | null;
  height: number | null;
  status: WorkVariantStatus;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  offers: WorkOffer[];
}

export interface Work {
  id: string;
  seriesId: string;
  seriesSlug: string;
  seriesName: string;
  legacyEpisodeId: number | null;
  sequenceNumber: number;
  displayCode: string;
  slug: string | null;
  title: string;
  themeCategory: string;
  summary: string | null;
  releasedOn: string | null;
  status: WorkStatus;
  publishedAt: string | null;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  variants: WorkVariant[];
  offers: WorkOffer[];
  primaryVariant: WorkVariant | null;
}

export interface WorkSeriesRow {
  id: string;
  slug: string;
  name: string;
  route_base: string;
  number_padding: number;
  sort_order: number;
  is_public: boolean;
}

export interface WorkRow {
  id: string;
  series_id: string;
  legacy_episode_id: number | null;
  sequence_number: number;
  display_code: string;
  slug: string | null;
  title: string;
  theme_category: string;
  summary: string | null;
  released_on: string | null;
  status: WorkStatus;
  published_at: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkVariantRow {
  id: string;
  work_id: string;
  variant_number: number;
  display_code: string;
  title: string | null;
  caption: string | null;
  variant_type: WorkVariantType;
  original_storage_key: string | null;
  thumbnail_storage_key: string | null;
  width: number | null;
  height: number | null;
  status: WorkVariantStatus;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkOfferRow {
  id: string;
  work_id: string;
  variant_id: string | null;
  offer_type: WorkOfferType;
  plan_type: WorkOfferPlanType;
  status: WorkOfferStatus;
  title: string | null;
  description: string | null;
  target_ref: string | null;
  target_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
