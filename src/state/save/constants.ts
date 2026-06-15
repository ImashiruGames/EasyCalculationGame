import { monsters } from '../../data/monsters';
import { shopItems } from '../../data/shopItems';
import { getAllBossBattleSaveIds } from '../../data/bossBattles';
import { stages } from '../../data/stages';
import { DEFAULT_TITLE_BACKGROUND_ID, titleBackgrounds } from '../../data/titleBackgrounds';
import { trainers } from '../../data/trainers';
import { AppSaveState, MonsterDefinition, StageDefinition } from '../../game/types';
import { DEFAULT_PRACTICE_LEVEL_ID } from '../../data/practiceLevels';
import { normalizeStageId } from '../../data/stageIdAliases';
import { createEmptyDailyMissionState } from './dailyMission';

export const STORAGE_KEY = 'one-digit-capture-game-save-v1';
export const knownMonsterIds = new Set(monsters.map((monster) => monster.id));
export const knownStageIds = new Set<string>(stages.map((stage) => stage.id));
export const playLimitDisabledStageIds = new Set<string>(
  stages.filter((stage) => stage.playLimitDisabled).map((stage) => stage.id),
);
export const knownFragmentKeys = new Set(monsters.map((monster) => monster.evolutionFamilyId));
export const fragmentKeyByMonsterId = new Map(monsters.map((monster) => [monster.id, monster.evolutionFamilyId]));
export const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
export const knownCandyAttributes = new Set(monsters.map((monster) => monster.attribute));
export const knownShopItemIds = new Set<string>(shopItems.map((item) => item.id));
export const knownTitleBackgroundIds = new Set<string>(titleBackgrounds.map((background) => background.id));
export const knownTrainerIds = new Set<string>([
  ...trainers.map((trainer) => trainer.id),
  ...getAllBossBattleSaveIds(),
]);

const legacyMonsterIdAliases = new Map<string, string>([
  ['awario', 'awazarashi'],
  ['hanapiko', 'hanahana'],
  ['hanaril', 'hanabell'],
  ['pururun', 'pururunrun'],
  ['yakiron', 'yakibunny'],
  ['yakidora', 'yakibanigon'],
  ['birigaon', 'biribiriman'],
  ['chirivolt', 'godchiri'],
  ['shizuck', 'shizukuchan'],
  ['shizuku', 'shizukuchan'],
  ['kageron', 'kagebouya'],
  ['tsukinowa', 'ootsukinoko'],
  ['yorupon', 'yoru'],
  ['nijiten', 'rainbow'],
  ['nokobold', 'nokobolt'],
  ['kurisageon', 'kurisage'],
  ['zerogard', 'zerogardx'],
  ['nokopon', 'zubagiri'],
  ['sunatama', 'sunasuna'],
  ['kirameki', 'kiramekisama'],
]);

const legacyFragmentKeyAliases = new Map<string, string>([
  ['hanapiko', 'hanahana'],
  ['pururun', 'pururunrun'],
  ['shizuku', 'shizukuchan'],
  ['yorupon', 'yoru'],
  ['nijiten', 'rainbow'],
  ['zerogard', 'zerogardx'],
  ['nokopon', 'zubagiri'],
  ['sunatama', 'sunasuna'],
  ['kirameki', 'kiramekisama'],
  ['ehon', 'ehonchan'],
  ['keshi', 'keshikeshikun'],
]);

export const FRAGMENTS_PER_CANDY = 5;
export const COINS_PER_CANDY = 30;
export const STAGE_PLAY_LIMIT = 10;
export const STAGE_PLAY_WINDOW_MS = 10 * 60 * 1000;
export const STAGE_SPEED_STAR_TARGET_MS = 3000;
export const NORMAL_CAPTURE_FRAGMENT_GAIN = 1;
export const RARE_CAPTURE_FRAGMENT_GAIN = 5;
export const ONE_STEP_EVOLVED_CAPTURE_FRAGMENT_GAIN = 3;
export const TWO_STEP_FIRST_EVOLVED_CAPTURE_FRAGMENT_GAIN = 2;
export const TWO_STEP_FINAL_EVOLVED_CAPTURE_FRAGMENT_GAIN = 4;
export const MAX_STAGE_CAPTURE_FRAGMENT_BONUS = 3;
export const DAILY_LOGIN_COIN_REWARDS = [10, 15, 20, 25, 30, 40, 60] as const;
export const DEFAULT_TITLE_MONSTER_IDS: Array<string | null> = ['picoleaf', 'hinokoro', 'yukipon', 'tenpico', 'kirapon'];

/** 新しいユーザーや壊れた保存データの復旧に使う、初期保存状態を作ります。 */
export function createDefaultSaveState(): AppSaveState {
  return {
    version: 5,
    practiceLevelId: DEFAULT_PRACTICE_LEVEL_ID,
    captures: {},
    fragments: {},
    candies: {},
    items: {},
    battleWins: {},
    stageCaptures: {},
    stageMonsterCaptures: {},
    stageSpeedStars: {},
    stagePlayLimits: {},
    dailyLogin: {
      lastClaimedDate: null,
      streakDays: 0,
      totalClaimDays: 0,
    },
    encounterStreak: {
      monsterId: null,
      count: 0,
    },
    bestStreakWins: 0,
    acknowledgedAchievementRankIndex: 0,
    coins: 0,
    dailyMissions: createEmptyDailyMissionState(),
    titleMonsterIds: [],
    titleMonsterPlacements: [],
    ownedTitleBackgroundIds: [],
    selectedTitleBackgroundId: DEFAULT_TITLE_BACKGROUND_ID,
    unlockedDexStoryMonsterIds: [],
  };
}

/** 保存数として使える正の整数だけを残し、不正値や未指定はnullにします。 */
export function normalizePositiveInteger(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
}

/** 保存レコードから正の個数だけを安全に取り出し、不正値は0にします。 */
export function getStoredPositiveCount(record: Record<string, number>, key: string): number {
  const count = record[key];
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/** モンスターIDから、同じ進化系で共有するかけらキーを返します。 */
export function getFragmentKey(monsterId: string): string {
  return fragmentKeyByMonsterId.get(monsterId) ?? monsterId;
}

/** 古いモンスターIDを現在のIDに直し、知らないIDならnullを返します。 */
export function normalizeMonsterId(monsterId: string): string | null {
  const currentMonsterId = legacyMonsterIdAliases.get(monsterId) ?? monsterId;
  return knownMonsterIds.has(currentMonsterId) ? currentMonsterId : null;
}

/** 古いかけらキーやモンスターIDを、現在の進化ファミリーキーに直します。 */
export function normalizeFragmentStorageKey(key: string): string | null {
  const monsterId = normalizeMonsterId(key);
  if (monsterId) {
    return getFragmentKey(monsterId);
  }

  const currentKey = legacyFragmentKeyAliases.get(key) ?? key;
  return knownFragmentKeys.has(currentKey) ? currentKey : null;
}

/** 捕獲時にもらえるかけら数を、進化段階・レア・ステージ難度から返します。 */
export function getCaptureFragmentGain(monsterId: string, stageId?: string): number {
  const monster = monsterById.get(monsterId);
  if (!monster) {
    return NORMAL_CAPTURE_FRAGMENT_GAIN;
  }

  const baseGain = Math.max(
    getEvolutionCaptureFragmentGain(monster),
    monster.isRare ? RARE_CAPTURE_FRAGMENT_GAIN : NORMAL_CAPTURE_FRAGMENT_GAIN,
  );
  return baseGain + getStageCaptureFragmentBonus(stageId);
}

/** 進化ラインの長さと現在段階から、基本のかけら獲得数を決めます。 */
function getEvolutionCaptureFragmentGain(monster: MonsterDefinition): number {
  if (monster.maxEvolutionStage <= 1 || monster.evolutionStage <= 1) {
    return NORMAL_CAPTURE_FRAGMENT_GAIN;
  }

  if (monster.maxEvolutionStage === 2) {
    return ONE_STEP_EVOLVED_CAPTURE_FRAGMENT_GAIN;
  }

  if (monster.evolutionStage === 2) {
    return TWO_STEP_FIRST_EVOLVED_CAPTURE_FRAGMENT_GAIN;
  }

  if (monster.evolutionStage === 3) {
    return TWO_STEP_FINAL_EVOLVED_CAPTURE_FRAGMENT_GAIN;
  }

  return TWO_STEP_FINAL_EVOLVED_CAPTURE_FRAGMENT_GAIN + (monster.evolutionStage - 3) * 2;
}

/** ステージの学年設定や並び順から、難しいステージ用の追加かけら数を返します。 */
function getStageCaptureFragmentBonus(stageId?: string): number {
  const currentStageId = stageId ? normalizeStageId(stageId) : undefined;
  const stage = stages.find((candidate) => candidate.id === currentStageId);
  if (!stage) {
    return 0;
  }

  return Math.min(
    MAX_STAGE_CAPTURE_FRAGMENT_BONUS,
    Math.max(
      getPracticeLevelFragmentBonus(stage),
      getStageOrderFragmentBonus(stage),
    ),
  );
}

/** 学年が高いステージほど、かけらボーナスを少し増やします。 */
function getPracticeLevelFragmentBonus(stage: StageDefinition): number {
  const practiceLevel = Math.max(stage.minPracticeLevel ?? 0, stage.maxPracticeLevel ?? 0);
  if (practiceLevel >= 7) {
    return 3;
  }

  if (practiceLevel >= 5) {
    return 2;
  }

  return practiceLevel >= 3 ? 1 : 0;
}

/** 同じカテゴリ内で後半のステージほど、かけらボーナスを少し増やします。 */
function getStageOrderFragmentBonus(stage: StageDefinition): number {
  return Math.max(0, Math.floor((stage.order - 1) / 20));
}
