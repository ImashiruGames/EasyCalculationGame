import { normalizeStageId } from '../../data/stageIdAliases';
import { AppSaveState } from '../../game/types';
import {
  knownShopItemIds,
  knownStageIds,
  normalizePositiveInteger,
  playLimitDisabledStageIds,
  STAGE_PLAY_LIMIT,
  STAGE_PLAY_WINDOW_MS,
} from './constants';
import { incrementDailyMissionCounter } from './dailyMission';
import { isActiveStagePlayWindow, normalizeStagePlayLimitRecord } from './stagePlayLimit';
import { loadSaveState, saveState } from './storage';

export interface StagePlayLimitStatus {
  isActive: boolean;
  isLimited: boolean;
  playCount: number;
  remainingPlays: number;
  remainingMs: number;
  windowStartedAt: number | null;
}

/** 指定ステージがプレイ回数制限の対象外かどうかを返します。 */
export function isStagePlayLimitDisabled(stageId: string): boolean {
  return playLimitDisabledStageIds.has(normalizeStageId(stageId));
}

/** 指定ステージの10分内プレイ回数と、今入れるかどうかを返します。 */
export function getStagePlayLimitStatus(
  state: AppSaveState,
  stageId: string,
  now = Date.now(),
): StagePlayLimitStatus {
  const currentStageId = normalizeStageId(stageId);
  if (isStagePlayLimitDisabled(currentStageId)) {
    return {
      isActive: false,
      isLimited: false,
      playCount: 0,
      remainingPlays: STAGE_PLAY_LIMIT,
      remainingMs: 0,
      windowStartedAt: null,
    };
  }

  const window = state.stagePlayLimits[currentStageId];
  if (!isActiveStagePlayWindow(window, now)) {
    return {
      isActive: false,
      isLimited: false,
      playCount: 0,
      remainingPlays: STAGE_PLAY_LIMIT,
      remainingMs: STAGE_PLAY_WINDOW_MS,
      windowStartedAt: null,
    };
  }

  const playCount = Math.min(STAGE_PLAY_LIMIT, Math.max(0, Math.floor(window.playCount)));
  const remainingMs = Math.max(0, STAGE_PLAY_WINDOW_MS - (now - window.startedAt));
  return {
    isActive: true,
    isLimited: playCount >= STAGE_PLAY_LIMIT && remainingMs > 0,
    playCount,
    remainingPlays: Math.max(0, STAGE_PLAY_LIMIT - playCount),
    remainingMs,
    windowStartedAt: window.startedAt,
  };
}

/** ステージ入場を記録し、制限回数とデイリーミッション進行を更新します。 */
export function recordStagePlayEntry(stageId: string, now = Date.now()): AppSaveState | null {
  const currentStageId = normalizeStageId(stageId);
  if (!knownStageIds.has(currentStageId)) {
    return null;
  }

  const current = loadSaveState();
  const status = getStagePlayLimitStatus(current, currentStageId, now);
  if (status.isLimited) {
    return null;
  }

  if (isStagePlayLimitDisabled(currentStageId)) {
    const nextStagePlayLimits = normalizeStagePlayLimitRecord(current.stagePlayLimits, now);
    delete nextStagePlayLimits[currentStageId];
    const next = incrementDailyMissionCounter({
      ...current,
      stagePlayLimits: nextStagePlayLimits,
    }, 'stageEntries', 1, now);
    if (!saveState(next)) {
      return null;
    }

    return next;
  }

  const currentWindow = current.stagePlayLimits[currentStageId];
  const startedAt = isActiveStagePlayWindow(currentWindow, now) ? currentWindow.startedAt : now;
  const nextStagePlayLimits = normalizeStagePlayLimitRecord(current.stagePlayLimits, now);
  nextStagePlayLimits[currentStageId] = {
    startedAt,
    playCount: status.playCount + 1,
  };

  const next = incrementDailyMissionCounter({
    ...current,
    stagePlayLimits: nextStagePlayLimits,
  }, 'stageEntries', 1, now);

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** アイテムを使ってステージへ入った記録を保存し、アイテム数も減らします。 */
export function recordStagePlayEntryUsingItem(
  stageId: string,
  itemId: string,
  count = 1,
  now = Date.now(),
): AppSaveState | null {
  const currentStageId = normalizeStageId(stageId);
  const normalizedCount = normalizePositiveInteger(count);
  if (!knownStageIds.has(currentStageId) || !knownShopItemIds.has(itemId) || normalizedCount === null) {
    return null;
  }

  const current = loadSaveState();
  const currentItemCount = current.items[itemId] ?? 0;
  const status = getStagePlayLimitStatus(current, currentStageId, now);
  if (status.isLimited || currentItemCount < normalizedCount) {
    return null;
  }

  const currentWindow = current.stagePlayLimits[currentStageId];
  const startedAt = isActiveStagePlayWindow(currentWindow, now) ? currentWindow.startedAt : now;
  const nextStagePlayLimits = normalizeStagePlayLimitRecord(current.stagePlayLimits, now);
  delete nextStagePlayLimits[currentStageId];
  if (!isStagePlayLimitDisabled(currentStageId)) {
    nextStagePlayLimits[currentStageId] = {
      startedAt,
      playCount: status.playCount + 1,
    };
  }

  const nextItems = {
    ...current.items,
    [itemId]: currentItemCount - normalizedCount,
  };
  if (nextItems[itemId] <= 0) {
    delete nextItems[itemId];
  }

  const next = incrementDailyMissionCounter({
    ...current,
    items: nextItems,
    stagePlayLimits: nextStagePlayLimits,
  }, 'stageEntries', 1, now);

  if (!saveState(next)) {
    return null;
  }

  return next;
}
