import { AppSaveState } from '../../game/types';
import { STORAGE_KEY, createDefaultSaveState } from './constants';
import { normalizeSaveState } from './normalize';

/** ブラウザ保存から進行状況を読み込み、壊れていれば初期状態へ戻します。 */
export function loadSaveState(): AppSaveState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultSaveState();
    }

    return normalizeSaveState(JSON.parse(raw));
  } catch {
    return createDefaultSaveState();
  }
}

/** 現在の進行状況をブラウザへ保存します。 */
export function saveState(state: AppSaveState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
