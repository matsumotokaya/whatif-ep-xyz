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
