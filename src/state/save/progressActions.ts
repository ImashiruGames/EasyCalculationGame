import { normalizePracticeLevelId } from '../../data/practiceLevels';
import { normalizeStageId } from '../../data/stageIdAliases';
import { stages } from '../../data/stages';
import { AppSaveState, PracticeLevelId } from '../../game/types';
import {
  getCaptureFragmentGain,
  getFragmentKey,
  knownCandyAttributes,
  knownMonsterIds,
  knownStageIds,
  normalizePositiveInteger,
} from './constants';
import { incrementDailyMissionCounter } from './dailyMission';
import { getStageSpeedStarTargetMs, hasStageSpeedStar } from './selectors';
import { loadSaveState, saveState } from './storage';
import {
  applyTransferCodeToSaveState,
  createTransferCodeFromSaveState,
  type TransferImportResult,
} from './transfer';

/** Checks whether a stage intro story has already been completed. */
export function hasReadStageIntroStory(state: AppSaveState, storyId: string | undefined): boolean {
  return Boolean(storyId && state.readStageIntroStoryIds.includes(storyId));
}

/** Marks a stage intro story as completed in the saved state. */
export function recordStageIntroStoryRead(storyId: string): AppSaveState | null {
  const normalizedStoryId = storyId.trim();
  if (!normalizedStoryId) {
    return null;
  }

  const current = loadSaveState();
  if (current.readStageIntroStoryIds.includes(normalizedStoryId)) {
    return current;
  }

  const next: AppSaveState = {
    ...current,
    readStageIntroStoryIds: [...current.readStageIntroStoryIds, normalizedStoryId],
  };
  return saveState(next) ? next : null;
}

/** 現在または指定された保存状態から、引き継ぎコードを作ります。 */
export function createTransferCode(state = loadSaveState()): string {
  return createTransferCodeFromSaveState(state);
}

/** 引き継ぎコードを読み込んで保存し、失敗時は理由つきの結果を返します。 */
export function importTransferCode(code: string): TransferImportResult {
  const result = applyTransferCodeToSaveState(loadSaveState(), code);
  if (result.status !== 'ok') {
    return result;
  }

  if (!saveState(result.state)) {
    return { status: 'saveFailed' };
  }

  return result;
}

/** 学年表示の選択を保存し、保存できた場合だけ新しい状態を返します。 */
export function setPracticeLevelId(practiceLevelId: PracticeLevelId): AppSaveState | null {
  const nextState: AppSaveState = {
    ...loadSaveState(),
    practiceLevelId: normalizePracticeLevelId(practiceLevelId),
  };

  return saveState(nextState) ? nextState : null;
}

/** 出現したモンスターを記録し、同じモンスターの連続出現回数を更新します。 */
export function recordEncounterMonster(monsterId: string): AppSaveState | null {
  if (!knownMonsterIds.has(monsterId)) {
    return null;
  }

  const current = loadSaveState();
  const currentStreak = current.encounterStreak;
  const nextCount = currentStreak.monsterId === monsterId ? currentStreak.count + 1 : 1;
  const next: AppSaveState = {
    ...current,
    encounterStreak: {
      monsterId,
      count: nextCount,
    },
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** モンスター捕獲を保存し、かけら・ステージクリア数・デイリー進行も増やします。 */
export function addCapture(monsterId: string, stageId?: string): AppSaveState {
  const current = loadSaveState();
  const currentStageId = stageId ? normalizeStageId(stageId) : undefined;
  const fragmentKey = getFragmentKey(monsterId);
  const fragmentGain = getCaptureFragmentGain(monsterId, currentStageId);
  const nextStageCaptures = { ...current.stageCaptures };
  if (currentStageId && knownStageIds.has(currentStageId)) {
    nextStageCaptures[currentStageId] = (nextStageCaptures[currentStageId] ?? 0) + 1;
  }
  const next = incrementDailyMissionCounter({
    ...current,
    captures: {
      ...current.captures,
      [monsterId]: (current.captures[monsterId] ?? 0) + 1,
    },
    fragments: {
      ...current.fragments,
      [fragmentKey]: (current.fragments[fragmentKey] ?? 0) + fragmentGain,
    },
    stageCaptures: nextStageCaptures,
  }, 'captures');

  saveState(next);
  return next;
}

/** ステージの1問あたり平均時間が目標以内なら、スピード星を達成済みにします。 */
export function recordStageAverageAnswerTime(stageId: string, averageMs: number): AppSaveState | null {
  const currentStageId = normalizeStageId(stageId);
  const normalizedAverageMs = normalizePositiveInteger(averageMs);
  if (!knownStageIds.has(currentStageId) || normalizedAverageMs === null) {
    return null;
  }

  const stage = stages.find((candidate) => candidate.id === currentStageId);
  if (!stage) {
    return null;
  }

  const current = loadSaveState();
  if (normalizedAverageMs > getStageSpeedStarTargetMs(stage) || hasStageSpeedStar(current, currentStageId)) {
    return current;
  }

  const next: AppSaveState = {
    ...current,
    stageSpeedStars: {
      ...current.stageSpeedStars,
      [currentStageId]: true,
    },
  };

  saveState(next);
  return next;
}

/** 対戦に勝ったときの報酬を保存します。難しい相手ほど呼び出し側で多い報酬を渡します。 */
export function addBattleReward(
  trainerId: string,
  coinReward: number,
  candyAttribute?: string,
  candyReward = 0,
): AppSaveState {
  const current = loadSaveState();
  const nextCandies = { ...current.candies };
  const normalizedCoinReward = normalizePositiveInteger(coinReward) ?? 0;
  const normalizedCandyReward = normalizePositiveInteger(candyReward) ?? 0;
  if (candyAttribute && knownCandyAttributes.has(candyAttribute) && normalizedCandyReward > 0) {
    nextCandies[candyAttribute] = (nextCandies[candyAttribute] ?? 0) + normalizedCandyReward;
  }

  const next = incrementDailyMissionCounter({
    ...current,
    candies: nextCandies,
    coins: current.coins + normalizedCoinReward,
    battleWins: {
      ...current.battleWins,
      [trainerId]: (current.battleWins[trainerId] ?? 0) + 1,
    },
  }, 'battleWins');

  saveState(next);
  return next;
}

/** 連続対戦の宝箱など、勝利数を増やさない追加報酬を保存します。 */
export function addBattleBonusReward(
  coinReward: number,
  candyAttribute?: string,
  candyReward = 0,
): AppSaveState {
  const current = loadSaveState();
  const nextCandies = { ...current.candies };
  const normalizedCoinReward = normalizePositiveInteger(coinReward) ?? 0;
  const normalizedCandyReward = normalizePositiveInteger(candyReward) ?? 0;
  if (candyAttribute && knownCandyAttributes.has(candyAttribute) && normalizedCandyReward > 0) {
    nextCandies[candyAttribute] = (nextCandies[candyAttribute] ?? 0) + normalizedCandyReward;
  }

  const next: AppSaveState = {
    ...current,
    candies: nextCandies,
    coins: current.coins + normalizedCoinReward,
  };

  saveState(next);
  return next;
}

/** 連続対戦で到達した最高突破数を保存します。 */
export function recordBestStreakWins(streakWins: number): AppSaveState {
  const current = loadSaveState();
  const normalizedStreakWins = Number.isFinite(streakWins) ? Math.max(0, Math.floor(streakWins)) : 0;
  if (normalizedStreakWins <= current.bestStreakWins) {
    return current;
  }

  const next: AppSaveState = {
    ...current,
    bestStreakWins: normalizedStreakWins,
  };

  saveState(next);
  return next;
}

/** ランクアップ演出を表示済みにして、同じランクのポップアップが繰り返し出ないようにします。 */
export function acknowledgeAchievementRankIndex(rankIndex: number): AppSaveState {
  const current = loadSaveState();
  const normalizedRankIndex = Number.isFinite(rankIndex) ? Math.max(0, Math.floor(rankIndex)) : 0;
  if (normalizedRankIndex <= current.acknowledgedAchievementRankIndex) {
    return current;
  }

  const next: AppSaveState = {
    ...current,
    acknowledgedAchievementRankIndex: normalizedRankIndex,
  };

  saveState(next);
  return next;
}

export interface EvolutionSaveResult {
  state: AppSaveState;
  evolvedCaptureCount: number;
  wasNew: boolean;
}
