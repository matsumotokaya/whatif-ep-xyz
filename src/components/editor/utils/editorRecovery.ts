import type { CanvasElement } from '../types/template';

const RECOVERY_VERSION = 1;
const RECOVERY_PREFIX = `whatif:editor-recovery:v${RECOVERY_VERSION}`;

export interface EditorRecoverySnapshot {
  version: typeof RECOVERY_VERSION;
  userId: string;
  bannerId: string;
  elements: CanvasElement[];
  canvasColor: string;
  updatedAt: string;
}

const recoveryKey = (userId: string, bannerId: string) =>
  `${RECOVERY_PREFIX}:${userId}:${bannerId}`;

export function readEditorRecovery(
  userId: string,
  bannerId: string,
): EditorRecoverySnapshot | null {
  try {
    const raw = localStorage.getItem(recoveryKey(userId, bannerId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<EditorRecoverySnapshot>;
    if (
      parsed.version !== RECOVERY_VERSION ||
      parsed.userId !== userId ||
      parsed.bannerId !== bannerId ||
      !Array.isArray(parsed.elements) ||
      typeof parsed.canvasColor !== 'string' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      localStorage.removeItem(recoveryKey(userId, bannerId));
      return null;
    }

    return parsed as EditorRecoverySnapshot;
  } catch {
    return null;
  }
}

export function writeEditorRecovery(snapshot: Omit<EditorRecoverySnapshot, 'version'>): boolean {
  try {
    localStorage.setItem(
      recoveryKey(snapshot.userId, snapshot.bannerId),
      JSON.stringify({ ...snapshot, version: RECOVERY_VERSION }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearEditorRecovery(userId: string, bannerId: string): void {
  try {
    localStorage.removeItem(recoveryKey(userId, bannerId));
  } catch {
    // Storage may be unavailable or disabled. The server save still succeeded.
  }
}
