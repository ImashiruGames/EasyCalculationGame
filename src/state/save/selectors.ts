import { normalizeStageId } from '../../data/stageIdAliases';
import {
  DEFAULT_TITLE_BACKGROUND_ID,
  TitleBackgroundDefinition,
  getTitleBackgroundById,
} from '../../data/titleBackgrounds';
import { TITLE_MONSTER_SLOT_COUNT } from '../../game/layoutConfig';
import { AppSaveState, StageDefinition, TitleMonsterPlacementState } from '../../game/types';
import {
  DEFAULT_TITLE_MONSTER_IDS,
  STAGE_SPEED_STAR_TARGET_MS,
  getFragmentKey,
  getStoredPositiveCount,
  knownCandyAttributes,
  knownMonsterIds,
  knownShopItemIds,
  knownStageIds,
  knownTrainerIds,
  monsterById,
  normalizePositiveInteger,
} from './constants';
import {
  buildTitleMonsterPlacementsFromIds,
  normalizeSelectedTitleBackgroundId,
  normalizeTitleBackgroundIds,
  normalizeTitleMonsterIds,
  normalizeTitleMonsterPlacements,
} from './title';

/** 重複を含めた総捕獲数を返します。将来の進化条件で使えます。 */
export function getTotalCaptureCount(state: AppSaveState): number {
  return Object.entries(state.captures).reduce(
    (total, [monsterId, count]) => total + (knownMonsterIds.has(monsterId) && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0),
    0,
  );
}

/** ステージ解放に使う、捕獲済みモンスターのユニーク種類数を返します。 */
export function getUniqueCaptureCount(state: AppSaveState): number {
  let uniqueCount = 0;
  for (const [monsterId, count] of Object.entries(state.captures)) {
    if (knownMonsterIds.has(monsterId) && Number.isFinite(count) && count > 0) {
      uniqueCount += 1;
    }
  }

  return uniqueCount;
}

/** 図鑑登録済みかどうかの表示に使う、個別モンスターの捕獲数を返します。 */
export function getMonsterCaptureCount(state: AppSaveState, monsterId: string): number {
  return knownMonsterIds.has(monsterId) ? getStoredPositiveCount(state.captures, monsterId) : 0;
}

/** 進化やアメ交換に使う、個別モンスターのかけら数を返します。 */
export function getMonsterFragmentCount(state: AppSaveState, monsterId: string): number {
  return knownMonsterIds.has(monsterId) ? getStoredPositiveCount(state.fragments, getFragmentKey(monsterId)) : 0;
}

/** 属性ごとのアメ所持数を、安全な正の整数として返します。 */
export function getCandyCount(state: AppSaveState, attribute: string): number {
  return knownCandyAttributes.has(attribute) ? getStoredPositiveCount(state.candies, attribute) : 0;
}

/** コイン所持数を、安全な正の整数として返します。 */
export function getCoinCount(state: AppSaveState): number {
  return Number.isFinite(state.coins) && state.coins > 0 ? Math.floor(state.coins) : 0;
}

/** アイテム所持数を、安全な正の整数として返します。 */
export function getItemCount(state: AppSaveState, itemId: string): number {
  return knownShopItemIds.has(itemId) ? getStoredPositiveCount(state.items, itemId) : 0;
}

/** 指定トレーナーへの勝利数を、安全な正の整数として返します。 */
export function getBattleWinCount(state: AppSaveState, trainerId: string): number {
  return knownTrainerIds.has(trainerId) ? getStoredPositiveCount(state.battleWins, trainerId) : 0;
}

/** ステージのモンスター定義から、IDだけを取り出します。 */
function getStageMonsterEntryId(monsterEntry: StageDefinition['monsterIds'][number]): string {
  return typeof monsterEntry === 'string' ? monsterEntry : monsterEntry.monsterId;
}

/** 進化先を最後までたどり、その進化系の最終モンスターIDを返します。 */
export function getFinalEvolutionMonsterId(monsterId: string): string {
  const visitedMonsterIds = new Set<string>();
  let currentMonster = monsterById.get(monsterId);
  while (currentMonster?.nextEvolutionId && !visitedMonsterIds.has(currentMonster.nextEvolutionId)) {
    visitedMonsterIds.add(currentMonster.id);
    currentMonster = monsterById.get(currentMonster.nextEvolutionId);
  }

  return currentMonster?.id ?? monsterId;
}

const STAGE_STAR_FIRST_CLEAR_TARGET = 1;

const STAGE_STAR_CLEAR_TARGET = 10;

/** ステージのスピード星に必要な、1問あたりの目標ミリ秒を返します。 */
export function getStageSpeedStarTargetMs(stage: StageDefinition): number {
  return normalizePositiveInteger(stage.speedStarAverageMs) ?? STAGE_SPEED_STAR_TARGET_MS;
}

/** ステージごとの5つの星条件を数え、星の数として返します。 */
export function getStageStarRank(state: AppSaveState, stage: StageDefinition): number {
  const stageMonsterIds = stage.monsterIds
    .map((monsterEntry) => getStageMonsterEntryId(monsterEntry))
    .filter((monsterId) => knownMonsterIds.has(monsterId));
  if (stageMonsterIds.length === 0) {
    return 0;
  }

  let starRank = 0;
  const stageClearCount = getStageCaptureCount(state, stage.id);
  const bonusTargetMonsterIds = stageMonsterIds.filter((monsterId) => !monsterById.get(monsterId)?.isRare);
  if (stageClearCount >= STAGE_STAR_FIRST_CLEAR_TARGET) {
    starRank += 1;
  }
  if (stageClearCount >= STAGE_STAR_CLEAR_TARGET) {
    starRank += 1;
  }

  if (bonusTargetMonsterIds.length > 0) {
    if (bonusTargetMonsterIds.every((monsterId) => getMonsterCaptureCount(state, monsterId) > 0)) {
      starRank += 1;
    }
    if (bonusTargetMonsterIds.every((monsterId) => getMonsterCaptureCount(state, getFinalEvolutionMonsterId(monsterId)) > 0)) {
      starRank += 1;
    }
  } else {
    starRank += 2;
  }

  if (hasStageSpeedStar(state, stage.id)) {
    starRank += 1;
  }

  return starRank;
}

/** 連続対戦の最高勝利数を、安全な正の整数として返します。 */
export function getBestStreakWins(state: AppSaveState): number {
  return Number.isFinite(state.bestStreakWins) && state.bestStreakWins > 0 ? Math.floor(state.bestStreakWins) : 0;
}

/** ステージごとの総捕獲数を返します。 */
export function getStageCaptureCount(state: AppSaveState, stageId: string): number {
  const currentStageId = normalizeStageId(stageId);
  return knownStageIds.has(currentStageId) ? getStoredPositiveCount(state.stageCaptures, currentStageId) : 0;
}

/** 指定ステージのスピード星を達成済みかどうかを返します。 */
export function hasStageSpeedStar(state: AppSaveState, stageId: string): boolean {
  const currentStageId = normalizeStageId(stageId);
  return knownStageIds.has(currentStageId) && state.stageSpeedStars[currentStageId] === true;
}

/** 指定ステージ内で、そのモンスターを捕獲した回数を返します。 */
export function getStageMonsterCaptureCount(state: AppSaveState, stageId: string, monsterId: string): number {
  const currentStageId = normalizeStageId(stageId);
  if (!knownStageIds.has(currentStageId) || !knownMonsterIds.has(monsterId)) {
    return 0;
  }

  return getStoredPositiveCount(state.stageMonsterCaptures[currentStageId] ?? {}, monsterId);
}

/** タイトルに並べるモンスターIDを、保存値または初期配置から取得します。 */
export function getTitleMonsterIds(state: AppSaveState): Array<string | null> {
  const customTitleMonsterPlacements = normalizeTitleMonsterPlacements(state.titleMonsterPlacements);
  if (customTitleMonsterPlacements.length > 0) {
    const titleMonsterIds: Array<string | null> = customTitleMonsterPlacements.map((placement) => placement.monsterId);
    return titleMonsterIds
      .concat(Array.from<string | null>({ length: TITLE_MONSTER_SLOT_COUNT }).fill(null))
      .slice(0, TITLE_MONSTER_SLOT_COUNT);
  }

  const customTitleMonsterIds = normalizeTitleMonsterIds(state.titleMonsterIds);
  return customTitleMonsterIds.length > 0 ? customTitleMonsterIds : DEFAULT_TITLE_MONSTER_IDS;
}

/** タイトル画面のモンスター配置を、保存値または背景ごとの初期配置から取得します。 */
export function getTitleMonsterPlacements(state: AppSaveState): TitleMonsterPlacementState[] {
  const customTitleMonsterPlacements = normalizeTitleMonsterPlacements(state.titleMonsterPlacements);
  if (customTitleMonsterPlacements.length > 0) {
    return customTitleMonsterPlacements;
  }

  return buildTitleMonsterPlacementsFromIds(
    getTitleMonsterIds(state),
    getSelectedTitleBackground(state).id,
  );
}

/** 所持しているタイトル背景IDを、初期背景込みで返します。 */
export function getOwnedTitleBackgroundIds(state: AppSaveState): string[] {
  return [
    DEFAULT_TITLE_BACKGROUND_ID,
    ...normalizeTitleBackgroundIds(state.ownedTitleBackgroundIds),
  ];
}

/** 指定タイトル背景を所持しているかどうかを判定します。 */
export function isTitleBackgroundOwned(state: AppSaveState, backgroundId: string): boolean {
  return getOwnedTitleBackgroundIds(state).includes(backgroundId);
}

/** 選択中のタイトル背景定義を、保存値を正規化してから取得します。 */
export function getSelectedTitleBackground(state: AppSaveState): TitleBackgroundDefinition {
  const selectedBackgroundId = normalizeSelectedTitleBackgroundId(
    state.selectedTitleBackgroundId,
    normalizeTitleBackgroundIds(state.ownedTitleBackgroundIds),
  );
  return getTitleBackgroundById(selectedBackgroundId);
}
