import { getLocalStorage } from '../state/browserStorage';

export const DEBUG_STAGE_CATEGORY_ID = 'debug';
const DEBUG_MODE_STORAGE_KEY = 'math-practice-debug-mode';

/** Reads whether the current URL asks for debug mode. */
function hasDebugUrlFlag(): boolean {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('debug') === '1';
}

/** Reads the hidden debug switch saved in this browser. */
export function isStoredDebugModeEnabled(): boolean {
  try {
    return getLocalStorage()?.getItem(DEBUG_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Saves the hidden debug switch in this browser. */
export function setStoredDebugModeEnabled(enabled: boolean): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    if (enabled) {
      storage.setItem(DEBUG_MODE_STORAGE_KEY, '1');
    } else {
      storage.removeItem(DEBUG_MODE_STORAGE_KEY);
    }
  } catch {
    // A disabled or full store must not interrupt the running game.
  }
}

/** Enables debug data only during development. */
export function isDebugModeEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined' || typeof window.location === 'undefined') {
    return false;
  }

  return hasDebugUrlFlag() || isStoredDebugModeEnabled();
}

/** Appends debug CSV rows when debug mode is enabled. */
export function appendDebugCsvRows(baseCsv: string, debugCsv: string): string {
  if (!isDebugModeEnabled()) {
    return baseCsv;
  }

  const debugRows = debugCsv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((row) => row.trim().length > 0);

  if (debugRows.length <= 1) {
    return baseCsv;
  }

  return `${baseCsv.trimEnd()}\n${debugRows.slice(1).join('\n')}`;
}
