export interface Episode {
  id: number;
  number: string; // "0001" format
  title: string;
  category: string;
  hasOriginalPng: boolean;
  hasThumbnailJpg: boolean;
  productUrl: string | null;
  createdAt: string; // ISO date
}

export interface EpisodesData {
  episodes: Episode[];
  total: number;
  lastUpdated: string;
}
