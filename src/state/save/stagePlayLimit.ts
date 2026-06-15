import { StagePlayLimitWindow } from '../../game/types';
import { normalizeStageId } from '../../data/stageIdAliases';
import { knownStageIds, STAGE_PLAY_LIMIT, STAGE_PLAY_WINDOW_MS } from './constants';

/** ステージ入場回数の制限窓が、今も有効かどうかを判定します。 */
export function isActiveStagePlayWindow(window: StagePlayLimitWindow | undefined, now = Date.now()): window is StagePlayLimitWindow {
  if (!window) {
    return false;
  }

  return Number.isFinite(window.startedAt)
    && Number.isFinite(window.playCount)
    && window.playCount > 0
    && window.startedAt <= now
    && now - window.startedAt < STAGE_PLAY_WINDOW_MS;
}

/** 保存されたステージ制限情報から、今も有効なステージだけを残します。 */
export function normalizeStagePlayLimitRecord(value: unknown, now = Date.now()): Record<string, StagePlayLimitWindow> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: Record<string, StagePlayLimitWindow> = {};
  for (const [stageId, rawWindow] of Object.entries(value)) {
    const currentStageId = normalizeStageId(stageId);
    if (!knownStageIds.has(currentStageId) || !rawWindow || typeof rawWindow !== 'object') {
      continue;
    }

    const startedAt = (rawWindow as Partial<StagePlayLimitWindow>).startedAt;
    const playCount = (rawWindow as Partial<StagePlayLimitWindow>).playCount;
    if (typeof startedAt !== 'number' || typeof playCount !== 'number') {
      continue;
    }

    const window = {
      startedAt,
      playCount: Math.min(STAGE_PLAY_LIMIT, Math.max(0, Math.floor(playCount))),
    };
    if (isActiveStagePlayWindow(window, now)) {
      normalized[currentStageId] = window;
    }
  }

  return normalized;
}
