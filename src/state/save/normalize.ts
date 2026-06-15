import { AppSaveState, EncounterStreakState } from '../../game/types';
import { getPrimaryStageIdForMonsterId } from '../../data/monsters';
import { normalizePracticeLevelId } from '../../data/practiceLevels';
import { normalizeStageId } from '../../data/stageIdAliases';
import { stages } from '../../data/stages';
import {
  createDefaultSaveState,
  knownCandyAttributes,
  knownShopItemIds,
  knownStageIds,
  normalizeFragmentStorageKey,
  normalizeMonsterId,
  STAGE_SPEED_STAR_TARGET_MS,
  knownTrainerIds,
} from './constants';
import { normalizeDailyLoginState } from './dailyLogin';
import { normalizeDailyMissionState } from './dailyMission';
import { normalizeStagePlayLimitRecord } from './stagePlayLimit';
import {
  buildTitleMonsterPlacementsFromIds,
  normalizeSelectedTitleBackgroundId,
  normalizeTitleBackgroundIds,
  normalizeTitleMonsterIds,
  normalizeTitleMonsterPlacements,
} from './title';

/** モンスターIDをキーにした個数レコードを、既知IDと正の整数だけに整えます。 */
function normalizeMonsterNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [monsterId, count] of Object.entries(value)) {
    const currentMonsterId = normalizeMonsterId(monsterId);
    if (currentMonsterId && typeof count === 'number' && Number.isFinite(count) && count > 0) {
      normalized[currentMonsterId] = (normalized[currentMonsterId] ?? 0) + Math.floor(count);
    }
  }

  return normalized;
}

/** モンスターIDの配列を、既知IDだけの重複しない配列へ整えます。 */
function normalizeMonsterIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((monsterId) => (
    typeof monsterId === 'string' ? normalizeMonsterId(monsterId) : null
  )).filter((monsterId): monsterId is string => Boolean(monsterId))));
}

/** 汎用の個数レコードを、必要なら既知キーに絞って正の整数だけ残します。 */
function normalizeNumberRecord(value: unknown, knownKeys?: ReadonlySet<string>): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if ((!knownKeys || knownKeys.has(key)) && typeof count === 'number' && Number.isFinite(count) && count > 0) {
      normalized[key] = Math.floor(count);
    }
  }

  return normalized;
}

/** かけら数を進化系キーへ寄せながら、正の整数だけに整えます。 */
function normalizeFragmentRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [rawKey, count] of Object.entries(value)) {
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
      continue;
    }

    const fragmentKey = normalizeFragmentStorageKey(rawKey);
    if (!fragmentKey) {
      continue;
    }

    normalized[fragmentKey] = (normalized[fragmentKey] ?? 0) + Math.floor(count);
  }

  return normalized;
}

/** ショップアイテムの所持数を、既知アイテムと正の整数だけに整えます。 */
function normalizeShopItemRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [itemId, count] of Object.entries(value)) {
    if (knownShopItemIds.has(itemId) && typeof count === 'number' && Number.isFinite(count) && count > 0) {
      normalized[itemId] = Math.floor(count);
    }
  }

  return normalized;
}

/** 連続出現モンスターの保存値を、既知モンスターと正の回数だけに整えます。 */
function normalizeEncounterStreakState(value: unknown): EncounterStreakState {
  if (!value || typeof value !== 'object') {
    return {
      monsterId: null,
      count: 0,
    };
  }

  const rawMonsterId = (value as Partial<EncounterStreakState>).monsterId;
  const rawCount = (value as Partial<EncounterStreakState>).count;
  const monsterId = typeof rawMonsterId === 'string' ? normalizeMonsterId(rawMonsterId) : null;
  if (
    !monsterId
    || typeof rawCount !== 'number'
    || !Number.isFinite(rawCount)
    || rawCount <= 0
  ) {
    return {
      monsterId: null,
      count: 0,
    };
  }

  return {
    monsterId,
    count: Math.floor(rawCount),
  };
}

/** ステージごとの捕獲数を、既知ステージと正の整数だけに整えます。 */
function normalizeStageCaptureRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [stageId, count] of Object.entries(value)) {
    const currentStageId = normalizeStageId(stageId);
    if (knownStageIds.has(currentStageId) && typeof count === 'number' && Number.isFinite(count) && count > 0) {
      normalized[currentStageId] = (normalized[currentStageId] ?? 0) + Math.floor(count);
    }
  }

  return normalized;
}

/** ステージごとのスピード星達成状態を、既知ステージとtrueだけに整えます。 */
function normalizeStageSpeedStarRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: Record<string, boolean> = {};
  for (const [stageId, isCleared] of Object.entries(value)) {
    const currentStageId = normalizeStageId(stageId);
    if (knownStageIds.has(currentStageId) && isCleared === true) {
      normalized[currentStageId] = true;
    }
  }

  return normalized;
}

/** 古い平均ミリ秒記録を、スピード星の達成状態へ変換します。 */
function convertStageAverageMsToSpeedStars(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const speedStars: Record<string, boolean> = {};
  for (const [stageId, averageMs] of Object.entries(value)) {
    const currentStageId = normalizeStageId(stageId);
    const stage = stages.find((candidate) => candidate.id === currentStageId);
    if (!stage) {
      continue;
    }

    const targetMs = typeof stage.speedStarAverageMs === 'number' && Number.isFinite(stage.speedStarAverageMs) && stage.speedStarAverageMs > 0
      ? stage.speedStarAverageMs
      : STAGE_SPEED_STAR_TARGET_MS;
    if (typeof averageMs === 'number' && Number.isFinite(averageMs) && averageMs > 0 && averageMs <= targetMs) {
      speedStars[currentStageId] = true;
    }
  }

  return speedStars;
}

/** 旧保存の全体捕獲数から、モンスター所属ステージを使ってステージ捕獲数を補完します。 */
function buildStageCapturesFromMonsterCaptures(captures: Record<string, number>): Record<string, number> {
  const stageCaptures: Record<string, number> = {};
  for (const [monsterId, count] of Object.entries(captures)) {
    const stageId = getPrimaryStageIdForMonsterId(monsterId);
    if (stageId && count > 0) {
      stageCaptures[stageId] = (stageCaptures[stageId] ?? 0) + count;
    }
  }

  return stageCaptures;
}

/** 読み込んだ保存データ全体を、現在のバージョンで安全に使える形へ正規化します。 */
export function normalizeSaveState(value: unknown): AppSaveState {
  if (!value || typeof value !== 'object') {
    return createDefaultSaveState();
  }

  const rawVersion = (value as Partial<AppSaveState>).version;
  const captures = (value as Partial<AppSaveState>).captures;
  const normalizedCaptures = normalizeMonsterNumberRecord(captures);
  const savedFragments = (value as Partial<AppSaveState>).fragments;
  const normalizedSavedFragments = normalizeFragmentRecord(savedFragments);
  const normalizedFragments = !savedFragments
    || (rawVersion !== 5 && Object.keys(normalizedSavedFragments).length === 0 && Object.keys(normalizedCaptures).length > 0)
    ? normalizeFragmentRecord(normalizedCaptures)
    : normalizedSavedFragments;
  const candies = normalizeNumberRecord((value as Partial<AppSaveState>).candies, knownCandyAttributes);
  const items = normalizeShopItemRecord((value as Partial<AppSaveState>).items);
  const battleWins = normalizeNumberRecord((value as Partial<AppSaveState>).battleWins, knownTrainerIds);
  const savedStageCaptures = (value as Partial<AppSaveState>).stageCaptures;
  const normalizedSavedStageCaptures = normalizeStageCaptureRecord(savedStageCaptures);
  const shouldBackfillStageCaptures = rawVersion !== 5 && Object.keys(normalizedCaptures).length > 0;
  const stageCaptures = shouldBackfillStageCaptures
    && (!savedStageCaptures || Object.keys(normalizedSavedStageCaptures).length === 0)
    ? buildStageCapturesFromMonsterCaptures(normalizedCaptures)
    : normalizedSavedStageCaptures;
  const stageMonsterCaptures: Record<string, Record<string, number>> = {};
  const stageSpeedStars = {
    ...convertStageAverageMsToSpeedStars((value as Partial<AppSaveState> & { stageBestAverageAnswerMs?: unknown }).stageBestAverageAnswerMs),
    ...normalizeStageSpeedStarRecord((value as Partial<AppSaveState>).stageSpeedStars),
  };
  const stagePlayLimits = normalizeStagePlayLimitRecord((value as Partial<AppSaveState>).stagePlayLimits);
  const dailyLogin = normalizeDailyLoginState((value as Partial<AppSaveState>).dailyLogin);
  const dailyMissions = normalizeDailyMissionState((value as Partial<AppSaveState>).dailyMissions);
  const encounterStreak = normalizeEncounterStreakState((value as Partial<AppSaveState>).encounterStreak);
  const rawBestStreakWins = (value as Partial<AppSaveState>).bestStreakWins;
  const rawAcknowledgedAchievementRankIndex = (value as Partial<AppSaveState>).acknowledgedAchievementRankIndex;
  const rawCoins = (value as Partial<AppSaveState>).coins;
  const titleMonsterIds = normalizeTitleMonsterIds((value as Partial<AppSaveState>).titleMonsterIds);
  const ownedTitleBackgroundIds = normalizeTitleBackgroundIds((value as Partial<AppSaveState>).ownedTitleBackgroundIds);
  const unlockedDexStoryMonsterIds = normalizeMonsterIdList((value as Partial<AppSaveState>).unlockedDexStoryMonsterIds);
  const selectedTitleBackgroundId = normalizeSelectedTitleBackgroundId(
    (value as Partial<AppSaveState>).selectedTitleBackgroundId,
    ownedTitleBackgroundIds,
  );
  const savedTitleMonsterPlacements = normalizeTitleMonsterPlacements(
    (value as Partial<AppSaveState>).titleMonsterPlacements,
  );
  const titleMonsterPlacements = savedTitleMonsterPlacements.length > 0
    ? savedTitleMonsterPlacements
    : buildTitleMonsterPlacementsFromIds(titleMonsterIds, selectedTitleBackgroundId);

  return {
    version: 5,
    practiceLevelId: normalizePracticeLevelId((value as Partial<AppSaveState>).practiceLevelId),
    captures: normalizedCaptures,
    fragments: normalizedFragments,
    candies,
    items,
    battleWins,
    stageCaptures,
    stageMonsterCaptures,
    stageSpeedStars,
    stagePlayLimits,
    dailyLogin,
    dailyMissions,
    encounterStreak,
    bestStreakWins: typeof rawBestStreakWins === 'number' && Number.isFinite(rawBestStreakWins) && rawBestStreakWins > 0
      ? Math.floor(rawBestStreakWins)
      : 0,
    acknowledgedAchievementRankIndex:
      typeof rawAcknowledgedAchievementRankIndex === 'number'
      && Number.isFinite(rawAcknowledgedAchievementRankIndex)
      && rawAcknowledgedAchievementRankIndex > 0
        ? Math.floor(rawAcknowledgedAchievementRankIndex)
        : 0,
    coins: typeof rawCoins === 'number' && Number.isFinite(rawCoins) && rawCoins > 0 ? Math.floor(rawCoins) : 0,
    titleMonsterIds,
    titleMonsterPlacements,
    ownedTitleBackgroundIds,
    selectedTitleBackgroundId,
    unlockedDexStoryMonsterIds,
  };
}
