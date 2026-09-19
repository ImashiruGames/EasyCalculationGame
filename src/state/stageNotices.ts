import type { StageDefinition } from '../game/types';
import { getLocalStorage } from './browserStorage';

const STORAGE_KEY = 'one-digit-stage-content-seen-v1';
const sessionSeen: Record<string, string> = {};

/** Reads seen content versions and tolerates unavailable or damaged browser storage. */
function loadSeenVersions(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(getLocalStorage()?.getItem(STORAGE_KEY) ?? '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).filter(([, version]) => typeof version === 'string'));
    }
  } catch {
    // Keep session behaviour available even when persistent storage cannot be read.
  }
  return {};
}

/** Shows new! until this device opens the stage's current content version. */
export function hasNewStageContent(stage: StageDefinition): boolean {
  if (!stage.newContentVersion || stage.comingSoon) {
    return false;
  }
  return (sessionSeen[stage.id] ?? loadSeenVersions()[stage.id]) !== stage.newContentVersion;
}

/** Remembers the opened version without changing progress or capture save data. */
export function markStageContentSeen(stage: StageDefinition): void {
  if (!stage.newContentVersion) {
    return;
  }
  sessionSeen[stage.id] = stage.newContentVersion;
  try {
    getLocalStorage()?.setItem(STORAGE_KEY, JSON.stringify({ ...loadSeenVersions(), ...sessionSeen }));
  } catch {
    // The in-memory version still prevents repeated badges during this session.
  }
}
