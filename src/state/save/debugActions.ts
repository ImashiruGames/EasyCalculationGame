import { isDebugModeEnabled } from '../../data/debugMode';
import { AppSaveState } from '../../game/types';
import { getStoredPositiveCount, knownMonsterIds, knownStageIds } from './constants';
import { loadSaveState, saveState } from './storage';

const DEBUG_STAGE_CAPTURE_COUNT = 30;

const DEBUG_STAGE_GATE_CAPTURE_COUNT = 20;

const DEBUG_COIN_AMOUNT = 999999;

/** 指定モンスターたちの捕獲数を、少なくとも指定数まで引き上げた新しい記録を返します。 */
function withMinimumCaptureCounts(
  captures: Record<string, number>,
  monsterIds: Iterable<string>,
  minimumCount: number,
): Record<string, number> {
  const nextCaptures = { ...captures };
  for (const monsterId of monsterIds) {
    if (!knownMonsterIds.has(monsterId)) {
      continue;
    }

    nextCaptures[monsterId] = Math.max(getStoredPositiveCount(nextCaptures, monsterId), minimumCount);
  }

  return nextCaptures;
}

/** デバッグ用に、ステージ解放条件を満たすだけのクリア状況を保存します。 */
export function debugUnlockAllStages(): AppSaveState | null {
  if (!isDebugModeEnabled()) {
    return null;
  }

  const current = loadSaveState();
  const nextStageCaptures = { ...current.stageCaptures };
  const nextStageSpeedStars = { ...current.stageSpeedStars };
  for (const stageId of knownStageIds) {
    nextStageCaptures[stageId] = Math.max(getStoredPositiveCount(nextStageCaptures, stageId), DEBUG_STAGE_CAPTURE_COUNT);
    nextStageSpeedStars[stageId] = true;
  }

  const gateMonsterIds = Array.from(knownMonsterIds).slice(0, DEBUG_STAGE_GATE_CAPTURE_COUNT);
  gateMonsterIds.push('tenpico');
  const next: AppSaveState = {
    ...current,
    captures: withMinimumCaptureCounts(current.captures, gateMonsterIds, 1),
    stageCaptures: nextStageCaptures,
    stageSpeedStars: nextStageSpeedStars,
  };

  return saveState(next) ? next : null;
}

/** デバッグ用に、現在CSVへ読み込まれているモンスターをすべて捕獲済みにします。 */
export function debugUnlockAllMonsters(): AppSaveState | null {
  if (!isDebugModeEnabled()) {
    return null;
  }

  const current = loadSaveState();
  const next: AppSaveState = {
    ...current,
    captures: withMinimumCaptureCounts(current.captures, knownMonsterIds, 1),
  };

  return saveState(next) ? next : null;
}

/** デバッグ用に、コインを確認しやすい大きな数へ直接そろえます。 */
export function debugSetCoinsToLargeAmount(): AppSaveState | null {
  if (!isDebugModeEnabled()) {
    return null;
  }

  const current = loadSaveState();
  const next: AppSaveState = {
    ...current,
    coins: DEBUG_COIN_AMOUNT,
  };

  return saveState(next) ? next : null;
}
