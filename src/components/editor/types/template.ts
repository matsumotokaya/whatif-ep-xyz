// Current version of the CanvasElement document schema. Bump this whenever
// migrateElements (src/components/editor/utils/elementMigration.ts) gains a
// new normalization step, so future logic can key off "what version was this
// document last migrated to" if needed.
//
// NOTE: there is no persisted schema_version column on public.banners yet
// (DB migrations are applied manually — see project CLAUDE.md). The
// migration function is written to be idempotent and safe to re-run on
// every load regardless of whether a version is tracked, so adding that
// column later is additive only and does not require changing this file's
// contract.
export const CURRENT_SCHEMA_VERSION = 1;

export interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  thumbnail?: string;
  planType?: 'free' | 'premium';
}

export interface TemplateRecord {
  id: string;
  name: string;
  elements?: CanvasElement[];
  canvasColor: string;
  thumbnailUrl?: string;
  planType?: 'free' | 'premium';
  displayOrder?: number;
  width?: number;
  height?: number;
  likeCount?: number;
  openCount?: number;
}

export interface BaseElement {
  id: string;
  type: 'text' | 'shape' | 'image';
  x: number;
  y: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;

  // Shadow properties
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  strokeOnly?: boolean;
  letterSpacing: number;
  lineHeight?: number; // Line height multiplier (e.g., 1.0 = 100%, 1.5 = 150%)
  align?: 'left' | 'center' | 'right'; // Paragraph alignment (default: 'left')

  // Fill properties
  fill: string;
  fillEnabled: boolean;

  // Stroke properties
  stroke: string;
  strokeWidth: number;
  strokeEnabled: boolean;

  fontWeight: number;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  width: number;
  height: number;
  shapeType: 'rectangle' | 'triangle' | 'star' | 'circle' | 'heart';

  // Fill properties
  fill: string;
  fillEnabled: boolean;

  // Stroke properties
  stroke: string;
  strokeWidth: number;
  strokeEnabled: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  width: number;
  height: number;
  blurRadius?: number;
}

export type CanvasElement = TextElement | ShapeElement | ImageElement;

export interface Banner {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  template: Template;
  elements: CanvasElement[];
  canvasColor: string;
  // Resolved public URLs (read side). Composed from the key columns at read
  // time, falling back to the legacy full-URL columns.
  thumbnailUrl?: string;
  fullresUrl?: string;
  // Relative asset keys (write side, M3). New writes populate these.
  thumbnailKey?: string;
  fullresKey?: string;
  previewStatus?: 'pending' | 'ready' | 'failed';
  previewSource?: 'none' | 'template' | 'generated';
  previewError?: string | null;
  documentRevision?: number;
  previewRevision?: number;
  previewRequestedAt?: string | null;
  previewCompletedAt?: string | null;
}

export interface BannerListItem {
  id: string;
  name: string;
  updatedAt: string;
  thumbnailUrl?: string;
  fullresUrl?: string;
  width?: number;
  height?: number;
  displayOrder?: number;
  previewStatus?: 'pending' | 'ready' | 'failed';
  previewSource?: 'none' | 'template' | 'generated';
  previewError?: string | null;
  documentRevision?: number;
  previewRevision?: number;
  previewRequestedAt?: string | null;
  previewCompletedAt?: string | null;
}
