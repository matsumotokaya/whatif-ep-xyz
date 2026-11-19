import type { Banner, CanvasElement, Template, TextElement } from '../types/template';
import type { EditorRecoverySnapshot } from './editorRecovery';
import { migrateElements } from './elementMigration';

// What the editor opens with, decided once per document.
export interface InitialDocument {
  elements: CanvasElement[];
  canvasColor: string;
  // The opened document already differs from what is stored and must be
  // saved right away (recovered edits, normalised legacy data, seeded text).
  needsSave: boolean;
  // A local recovery snapshot exists but the stored document is at least as
  // new, so the snapshot is obsolete.
  discardRecovery: boolean;
}

function createStarterText(template: Pick<Template, 'width' | 'height'>, id: string): TextElement {
  return {
    id,
    type: 'text',
    text: "Let's create\nyour banner\nwith IMAGINE.",
    x: template.width / 2 - 200,
    y: template.height / 2 - 110,
    fontSize: 60,
    fontFamily: 'Arial',
    letterSpacing: 0,
    fill: '#000000',
    fillEnabled: true,
    stroke: '#000000',
    strokeWidth: 2,
    strokeEnabled: false,
    fontWeight: 400,
    align: 'center',
    visible: true,
  };
}

// A signed-in user's saved design. Unsaved local edits that are newer than
// the stored row win, so a crash or closed tab never loses work.
export function buildMemberInitialDocument(
  banner: Pick<Banner, 'elements' | 'canvasColor' | 'updatedAt' | 'template'>,
  recovery: EditorRecoverySnapshot | null,
  createId: () => string,
): InitialDocument {
  const migrated = migrateElements(banner.elements);
  const recoveryTime = recovery ? Date.parse(recovery.updatedAt) : Number.NaN;
  const recoveryIsNewer = !!recovery && Number.isFinite(recoveryTime) && recoveryTime > Date.parse(banner.updatedAt);

  const elements = recoveryIsNewer && recovery ? migrateElements(recovery.elements) : migrated;
  const canvasColor = recoveryIsNewer && recovery ? recovery.canvasColor : banner.canvasColor;
  const migrationChangedDocument = JSON.stringify(banner.elements) !== JSON.stringify(migrated);

  // A brand-new design opens with a starter text instead of an empty artboard.
  if (elements.length === 0) {
    return {
      elements: [createStarterText(banner.template, createId())],
      canvasColor,
      needsSave: true,
      discardRecovery: !!recovery && !recoveryIsNewer,
    };
  }

  return {
    elements,
    canvasColor,
    needsSave: recoveryIsNewer || migrationChangedDocument,
    discardRecovery: !!recovery && !recoveryIsNewer,
  };
}

// A guest design (opened from a template or restored from this browser).
export function buildGuestInitialDocument(elements: CanvasElement[] | undefined, canvasColor: string | undefined): InitialDocument {
  return {
    elements: migrateElements(elements ?? []),
    canvasColor: canvasColor || '#FFFFFF',
    needsSave: false,
    discardRecovery: false,
  };
}
