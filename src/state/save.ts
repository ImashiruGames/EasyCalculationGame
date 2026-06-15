import { SHOP_ITEM_IDS } from '../data/shopItems';
import {
  DEFAULT_TITLE_BACKGROUND_ID,
  getTitleBackgroundById,
  TitleBackgroundDefinition,
} from '../data/titleBackgrounds';
import { stages } from '../data/stages';
import {
  DAILY_MISSION_ALL_CLEAR_REWARD,
  DailyMissionDefinition,
  DailyMissionReward,
  dailyMissions,
  getDailyMissionRewardLabel,
} from '../data/dailyMissions';
import { getEmbeddedStoryDraftForMonsterDex } from '../data/stories';
import { isDebugModeEnabled } from '../data/debugMode';
import { normalizePracticeLevelId } from '../data/practiceLevels';
import { normalizeStageId } from '../data/stageIdAliases';
import { TITLE_MONSTER_SLOT_COUNT } from '../game/layoutConfig';
import { AppSaveState, MonsterDefinition, PracticeLevelId, StageDefinition, TitleMonsterPlacementState } from '../game/types';
import {
  COINS_PER_CANDY,
  createDefaultSaveState,
  DAILY_LOGIN_COIN_REWARDS,
  DEFAULT_TITLE_MONSTER_IDS,
  FRAGMENTS_PER_CANDY,
  getCaptureFragmentGain,
  getFragmentKey,
  getStoredPositiveCount,
  knownCandyAttributes,
  knownMonsterIds,
  knownShopItemIds,
  knownStageIds,
  knownTitleBackgroundIds,
  knownTrainerIds,
  monsterById,
  normalizePositiveInteger,
  playLimitDisabledStageIds,
  STAGE_PLAY_LIMIT,
  STAGE_PLAY_WINDOW_MS,
  STAGE_SPEED_STAR_TARGET_MS,
  STORAGE_KEY,
} from './save/constants';
import {
  getDailyLoginRewardLabel,
  getDateKeyDayIndex,
  getLocalDateKey,
  getNextLoginStreakDays,
} from './save/dailyLogin';
import {
  getDailyMissionStateForToday,
  incrementDailyMissionCounter,
} from './save/dailyMission';
import { normalizeSaveState } from './save/normalize';
import { isActiveStagePlayWindow, normalizeStagePlayLimitRecord } from './save/stagePlayLimit';
import {
  buildTitleMonsterPlacementsFromIds,
  normalizeSelectedTitleBackgroundId,
  normalizeTitleBackgroundIds,
  normalizeTitleMonsterIds,
  normalizeTitleMonsterPlacements,
} from './save/title';
import {
  applyTransferCodeToSaveState,
  createTransferCodeFromSaveState,
  type TransferImportResult,
} from './save/transfer';

export {
  COINS_PER_CANDY,
  DAILY_LOGIN_COIN_REWARDS,
  FRAGMENTS_PER_CANDY,
  STAGE_PLAY_LIMIT,
  STAGE_PLAY_WINDOW_MS,
} from './save/constants';
export {
  TITLE_MONSTER_DEFAULT_SIZE,
  TITLE_MONSTER_MAX_SIZE,
  TITLE_MONSTER_MIN_SIZE,
  TITLE_MONSTER_PLACEMENT_BOUNDS,
  TITLE_MONSTER_SLOT_COUNT,
} from '../game/layoutConfig';
export { getTransferSummary, TRANSFER_CODE_PREFIX } from './save/transfer';
export type { TransferImportResult, TransferSummary } from './save/transfer';

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

export interface DailyLoginBonusStatus {
  todayKey: string;
  canClaim: boolean;
  cycleDay: number;
  streakDays: number;
  totalClaimDays: number;
  rewardCoins: number;
  rewardItemId: string | null;
  rewardItemCount: number;
  rewardLabel: string;
}

export interface DailyLoginBonusClaimResult {
  state: AppSaveState;
  status: DailyLoginBonusStatus;
}

export interface DailyMissionStatus {
  mission: DailyMissionDefinition;
  current: number;
  target: number;
  isComplete: boolean;
  isClaimed: boolean;
  rewardLabel: string;
}

export interface DailyMissionBoardStatus {
  todayKey: string;
  missions: DailyMissionStatus[];
  completedCount: number;
  claimedCount: number;
  allClearComplete: boolean;
  allClearClaimed: boolean;
  allClearRewardLabel: string;
}

export interface DailyMissionClaimResult {
  state: AppSaveState;
  rewardLabel: string;
}

const DEBUG_STAGE_CAPTURE_COUNT = 30;
const DEBUG_STAGE_GATE_CAPTURE_COUNT = 20;
const DEBUG_COIN_AMOUNT = 999999;

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

/** デイリーミッション報酬のコインやアイテムを、保存状態へ加算します。 */
function applyDailyMissionReward(state: AppSaveState, reward: DailyMissionReward): AppSaveState {
  const nextItems = { ...state.items };
  if (reward.itemId && reward.itemCount && reward.itemCount > 0) {
    nextItems[reward.itemId] = (nextItems[reward.itemId] ?? 0) + reward.itemCount;
  }

  return {
    ...state,
    coins: state.coins + (reward.coins ?? 0),
    items: nextItems,
  };
}

/** ミッション定義が見ている進行カウンターの現在値を返します。 */
function getDailyMissionProgressValue(
  state: AppSaveState,
  mission: DailyMissionDefinition,
  now = Date.now(),
): number {
  const dailyMissionState = getDailyMissionStateForToday(state, now);
  return dailyMissionState[mission.progressKey];
}

/** 今日のデイリーミッション一覧と達成・受け取り状況をまとめて返します。 */
export function getDailyMissionBoardStatus(
  state: AppSaveState,
  now = Date.now(),
): DailyMissionBoardStatus {
  const dailyMissionState = getDailyMissionStateForToday(state, now);
  const missions = dailyMissions.map((mission) => {
    const current = Math.min(mission.target, getDailyMissionProgressValue(state, mission, now));
    const isClaimed = dailyMissionState.claimedMissionIds.includes(mission.id);
    return {
      mission,
      current,
      target: mission.target,
      isComplete: current >= mission.target,
      isClaimed,
      rewardLabel: getDailyMissionRewardLabel(mission.reward),
    };
  });
  const completedCount = missions.filter((mission) => mission.isComplete).length;
  const claimedCount = missions.filter((mission) => mission.isClaimed).length;

  return {
    todayKey: dailyMissionState.dateKey,
    missions,
    completedCount,
    claimedCount,
    allClearComplete: completedCount >= missions.length,
    allClearClaimed: dailyMissionState.allClearClaimed,
    allClearRewardLabel: getDailyMissionRewardLabel(DAILY_MISSION_ALL_CLEAR_REWARD),
  };
}

/** メニューに出すおすすめミッションを、未受け取りのものから優先して選びます。 */
export function getSuggestedDailyMissionStatus(
  state: AppSaveState,
  now = Date.now(),
): DailyMissionStatus | null {
  const boardStatus = getDailyMissionBoardStatus(state, now);
  return boardStatus.missions.find((mission) => !mission.isClaimed && !mission.isComplete)
    ?? boardStatus.missions.find((mission) => !mission.isClaimed)
    ?? null;
}

/** 達成済みのデイリーミッション報酬を受け取り、受け取り済みにします。 */
export function claimDailyMissionReward(
  missionId: string,
  now = Date.now(),
): DailyMissionClaimResult | null {
  const mission = dailyMissions.find((candidate) => candidate.id === missionId);
  if (!mission) {
    return null;
  }

  const current = loadSaveState();
  const dailyMissionState = getDailyMissionStateForToday(current, now);
  const progress = getDailyMissionProgressValue(current, mission, now);
  if (progress < mission.target || dailyMissionState.claimedMissionIds.includes(mission.id)) {
    return null;
  }

  const nextState = applyDailyMissionReward({
    ...current,
    dailyMissions: {
      ...dailyMissionState,
      claimedMissionIds: [...dailyMissionState.claimedMissionIds, mission.id],
    },
  }, mission.reward);

  if (!saveState(nextState)) {
    return null;
  }

  return {
    state: nextState,
    rewardLabel: getDailyMissionRewardLabel(mission.reward),
  };
}

/** 全ミッション達成ボーナスを受け取り、1日1回だけ保存します。 */
export function claimDailyMissionAllClearReward(now = Date.now()): DailyMissionClaimResult | null {
  const current = loadSaveState();
  const dailyMissionState = getDailyMissionStateForToday(current, now);
  const boardStatus = getDailyMissionBoardStatus(current, now);
  if (!boardStatus.allClearComplete || dailyMissionState.allClearClaimed) {
    return null;
  }

  const nextState = applyDailyMissionReward({
    ...current,
    dailyMissions: {
      ...dailyMissionState,
      allClearClaimed: true,
    },
  }, DAILY_MISSION_ALL_CLEAR_REWARD);

  if (!saveState(nextState)) {
    return null;
  }

  return {
    state: nextState,
    rewardLabel: getDailyMissionRewardLabel(DAILY_MISSION_ALL_CLEAR_REWARD),
  };
}

/** 今日のログインボーナスが受け取れるか、受け取るなら何日目かを返します。 */
export function getDailyLoginBonusStatus(
  state: AppSaveState,
  now = Date.now(),
): DailyLoginBonusStatus {
  const todayKey = getLocalDateKey(now);
  const lastClaimedDayIndex = getDateKeyDayIndex(state.dailyLogin.lastClaimedDate);
  const todayDayIndex = getDateKeyDayIndex(todayKey);
  const canClaim = state.dailyLogin.lastClaimedDate !== todayKey
    && (lastClaimedDayIndex === null || todayDayIndex === null || lastClaimedDayIndex < todayDayIndex);
  const streakDays = getNextLoginStreakDays(state, todayKey);
  const cycleDay = ((Math.max(1, streakDays) - 1) % DAILY_LOGIN_COIN_REWARDS.length) + 1;
  const rewardCoins = DAILY_LOGIN_COIN_REWARDS[cycleDay - 1];
  const rewardItemId = cycleDay === DAILY_LOGIN_COIN_REWARDS.length ? SHOP_ITEM_IDS.rareBell : null;
  const rewardItemCount = rewardItemId ? 1 : 0;
  const totalClaimDays = canClaim ? state.dailyLogin.totalClaimDays + 1 : state.dailyLogin.totalClaimDays;
  const status = {
    todayKey,
    canClaim,
    cycleDay,
    streakDays,
    totalClaimDays,
    rewardCoins,
    rewardItemId,
    rewardItemCount,
    rewardLabel: '',
  };

  return {
    ...status,
    rewardLabel: getDailyLoginRewardLabel(status),
  };
}

/** 1日1回のログインボーナスを保存に反映します。すでに受け取り済みならnullです。 */
export function claimDailyLoginBonus(now = Date.now()): DailyLoginBonusClaimResult | null {
  const current = loadSaveState();
  const status = getDailyLoginBonusStatus(current, now);
  if (!status.canClaim) {
    return null;
  }

  const nextItems = { ...current.items };
  if (status.rewardItemId && status.rewardItemCount > 0) {
    nextItems[status.rewardItemId] = (nextItems[status.rewardItemId] ?? 0) + status.rewardItemCount;
  }

  const next: AppSaveState = {
    ...current,
    coins: current.coins + status.rewardCoins,
    items: nextItems,
    dailyLogin: {
      lastClaimedDate: status.todayKey,
      streakDays: status.streakDays,
      totalClaimDays: status.totalClaimDays,
    },
  };

  if (!saveState(next)) {
    return null;
  }

  return {
    state: next,
    status,
  };
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

interface EvolutionSaveResult {
  state: AppSaveState;
  evolvedCaptureCount: number;
  wasNew: boolean;
}

/** かけらを消費して進化先を図鑑登録します。進化では進化先のかけらは増やしません。 */
export function evolveMonster(
  sourceMonsterId: string,
  evolvedMonsterId: string,
  requiredFragments: number,
): EvolutionSaveResult | null {
  const sourceMonster = monsterById.get(sourceMonsterId);
  const evolvedMonster = monsterById.get(evolvedMonsterId);
  const requiredFragmentCount = normalizePositiveInteger(requiredFragments);
  if (!sourceMonster || !evolvedMonster || sourceMonster.nextEvolutionId !== evolvedMonsterId || requiredFragmentCount === null) {
    return null;
  }

  const current = loadSaveState();
  if ((current.captures[evolvedMonsterId] ?? 0) > 0) {
    return null;
  }

  const fragmentKey = getFragmentKey(sourceMonsterId);
  const currentFragments = current.fragments[fragmentKey] ?? 0;
  if (currentFragments < requiredFragmentCount) {
    return null;
  }

  const evolvedCaptureCount = (current.captures[evolvedMonsterId] ?? 0) + 1;
  const nextFragments = {
    ...current.fragments,
    [fragmentKey]: currentFragments - requiredFragmentCount,
  };
  if (nextFragments[fragmentKey] <= 0) {
    delete nextFragments[fragmentKey];
  }

  const next: AppSaveState = {
    ...current,
    fragments: nextFragments,
    captures: {
      ...current.captures,
      [evolvedMonsterId]: evolvedCaptureCount,
    },
  };

  if (!saveState(next)) {
    return null;
  }

  return {
    state: next,
    evolvedCaptureCount,
    wasNew: evolvedCaptureCount === 1,
  };
}

/** キャラクターのかけらを、その属性のアメへ交換するための保存処理です。 */
export function exchangeFragmentsForCandy(
  monsterId: string,
  attribute: string,
  fragmentCost = FRAGMENTS_PER_CANDY,
): AppSaveState | null {
  const current = loadSaveState();
  if (!canExchangeFragmentsForCandy(current, monsterId, attribute, fragmentCost)) {
    return null;
  }

  const normalizedFragmentCost = normalizePositiveInteger(fragmentCost);
  const fragmentKey = getFragmentKey(monsterId);
  const currentFragments = current.fragments[fragmentKey] ?? 0;

  const nextFragments = {
    ...current.fragments,
    [fragmentKey]: currentFragments - (normalizedFragmentCost ?? FRAGMENTS_PER_CANDY),
  };
  if (nextFragments[fragmentKey] <= 0) {
    delete nextFragments[fragmentKey];
  }

  const next: AppSaveState = {
    ...current,
    fragments: nextFragments,
    candies: {
      ...current.candies,
      [attribute]: (current.candies[attribute] ?? 0) + 1,
    },
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** かけらをアメに交換できるかを、進化完了と図鑑ストーリー解放状況まで含めて判定します。 */
export function canExchangeFragmentsForCandy(
  state: AppSaveState,
  monsterId: string,
  attribute: string,
  fragmentCost = FRAGMENTS_PER_CANDY,
): boolean {
  const monster = monsterById.get(monsterId);
  const normalizedFragmentCost = normalizePositiveInteger(fragmentCost);
  if (!monster
    || !knownCandyAttributes.has(attribute)
    || monster.attribute !== attribute
    || normalizedFragmentCost === null) {
    return false;
  }

  return getStoredPositiveCount(state.fragments, getFragmentKey(monsterId)) >= normalizedFragmentCost
    && isEvolutionFamilyComplete(state, monster)
    && areRequiredDexStoriesUnlockedForCandy(state, monster);
}

/** その進化系の最終形を登録済みなら、進化が終わったものとして扱います。 */
function isEvolutionFamilyComplete(state: AppSaveState, monster: MonsterDefinition): boolean {
  return getStoredPositiveCount(state.captures, getFinalEvolutionMonsterId(monster.id)) > 0;
}

/** アメ交換前に優先したい図鑑ストーリーが、すべて解放済みか調べます。 */
function areRequiredDexStoriesUnlockedForCandy(state: AppSaveState, monster: MonsterDefinition): boolean {
  return getEvolutionFamily(monster).every((familyMonster) => {
    if (!familyMonster.dexStoryEnabled
      || normalizePositiveInteger(familyMonster.dexStoryRequiredFragments) === null
      || !getEmbeddedStoryDraftForMonsterDex(familyMonster.id)) {
      return true;
    }

    return isDexStoryUnlocked(state, familyMonster.id);
  });
}

/** 同じ進化系のモンスターを、進化順に並べて返します。 */
function getEvolutionFamily(monster: MonsterDefinition): MonsterDefinition[] {
  return Array.from(monsterById.values())
    .filter((candidate) => candidate.evolutionFamilyId === monster.evolutionFamilyId)
    .sort((left, right) => left.evolutionStage - right.evolutionStage);
}

/** 指定モンスターの図鑑ストーリーが解放済みかどうかを返します。 */
export function isDexStoryUnlocked(state: AppSaveState, monsterId: string): boolean {
  return knownMonsterIds.has(monsterId) && state.unlockedDexStoryMonsterIds.includes(monsterId);
}

/** 指定モンスターの図鑑ストーリーを、かけら消費で解放できる状態か調べます。 */
export function canUnlockDexStory(state: AppSaveState, monsterId: string): boolean {
  const monster = monsterById.get(monsterId);
  const requiredFragments = normalizePositiveInteger(monster?.dexStoryRequiredFragments);
  if (!monster || !monster.dexStoryEnabled || requiredFragments === null || isDexStoryUnlocked(state, monsterId)) {
    return false;
  }

  return getStoredPositiveCount(state.captures, monsterId) > 0
    && arePreviousDexStoriesUnlocked(state, monster)
    && getStoredPositiveCount(state.fragments, getFragmentKey(monsterId)) >= requiredFragments;
}

/** 図鑑ストーリー解放時に、同じ属性のアメで足りないかけらを補えるか調べます。 */
export function canUnlockDexStoryWithCandy(state: AppSaveState, monsterId: string): boolean {
  const missingFragments = getDexStoryUnlockCandyShortfall(state, monsterId);
  if (missingFragments === null || missingFragments <= 0) {
    return false;
  }

  const monster = monsterById.get(monsterId);
  return Boolean(monster && getStoredPositiveCount(state.candies, monster.attribute) >= missingFragments);
}

/** 図鑑ストーリー解放でアメ補助が必要な時、不足しているかけら数を返します。 */
export function getDexStoryUnlockCandyShortfall(state: AppSaveState, monsterId: string): number | null {
  const monster = monsterById.get(monsterId);
  const requiredFragments = normalizePositiveInteger(monster?.dexStoryRequiredFragments);
  if (!monster || !monster.dexStoryEnabled || requiredFragments === null || isDexStoryUnlocked(state, monsterId)) {
    return null;
  }

  if (getStoredPositiveCount(state.captures, monsterId) <= 0 || !arePreviousDexStoriesUnlocked(state, monster)) {
    return null;
  }

  return Math.max(0, requiredFragments - getStoredPositiveCount(state.fragments, getFragmentKey(monsterId)));
}

/** 進化前に解放対象の図鑑ストーリーがあれば、すべて解放済みか調べます。 */
function arePreviousDexStoriesUnlocked(state: AppSaveState, monster: MonsterDefinition): boolean {
  let previousId = monster.previousEvolutionId;
  while (previousId) {
    const previousMonster = monsterById.get(previousId);
    if (!previousMonster) {
      return true;
    }

    if (previousMonster.dexStoryEnabled && !isDexStoryUnlocked(state, previousMonster.id)) {
      return false;
    }

    previousId = previousMonster.previousEvolutionId;
  }

  return true;
}

/** かけらを消費して、指定モンスターの図鑑ストーリーを解放します。 */
export function unlockDexStory(monsterId: string, useCandyForShortfall = false): AppSaveState | null {
  const monster = monsterById.get(monsterId);
  const requiredFragments = normalizePositiveInteger(monster?.dexStoryRequiredFragments);
  if (!monster || !monster.dexStoryEnabled || requiredFragments === null) {
    return null;
  }

  const current = loadSaveState();
  if (isDexStoryUnlocked(current, monsterId)) {
    return current;
  }

  if (!canUnlockDexStory(current, monsterId) && !(useCandyForShortfall && canUnlockDexStoryWithCandy(current, monsterId))) {
    return null;
  }

  const fragmentKey = getFragmentKey(monsterId);
  const currentFragments = getStoredPositiveCount(current.fragments, fragmentKey);
  const usedFragments = Math.min(currentFragments, requiredFragments);
  const missingFragments = requiredFragments - usedFragments;
  const currentCandies = getStoredPositiveCount(current.candies, monster.attribute);
  if (missingFragments > 0 && (!useCandyForShortfall || currentCandies < missingFragments)) {
    return null;
  }

  const nextFragments = {
    ...current.fragments,
    [fragmentKey]: currentFragments - usedFragments,
  };
  if (nextFragments[fragmentKey] <= 0) {
    delete nextFragments[fragmentKey];
  }
  const nextCandies = { ...current.candies };
  if (missingFragments > 0) {
    nextCandies[monster.attribute] = currentCandies - missingFragments;
    if (nextCandies[monster.attribute] <= 0) {
      delete nextCandies[monster.attribute];
    }
  }

  const next: AppSaveState = {
    ...current,
    fragments: nextFragments,
    candies: nextCandies,
    unlockedDexStoryMonsterIds: Array.from(new Set([...current.unlockedDexStoryMonsterIds, monsterId])),
  };

  return saveState(next) ? next : null;
}

/** アメをコインへ交換する保存処理です。 */
export function exchangeCandyForCoins(
  attribute: string,
  candyCost = 1,
  coinsPerCandy = COINS_PER_CANDY,
): AppSaveState | null {
  const normalizedCandyCost = normalizePositiveInteger(candyCost);
  const normalizedCoinsPerCandy = normalizePositiveInteger(coinsPerCandy);
  const current = loadSaveState();
  const currentCandies = current.candies[attribute] ?? 0;
  if (!knownCandyAttributes.has(attribute)
    || normalizedCandyCost === null
    || normalizedCoinsPerCandy === null
    || currentCandies < normalizedCandyCost) {
    return null;
  }

  const nextCandies = {
    ...current.candies,
    [attribute]: currentCandies - normalizedCandyCost,
  };
  if (nextCandies[attribute] <= 0) {
    delete nextCandies[attribute];
  }

  const next: AppSaveState = {
    ...current,
    candies: nextCandies,
    coins: current.coins + normalizedCandyCost * normalizedCoinsPerCandy,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** ショップでコインを使ってアイテムを買います。 */
export function buyShopItem(itemId: string, price: number): AppSaveState | null {
  const normalizedPrice = normalizePositiveInteger(price);
  const current = loadSaveState();
  if (!knownShopItemIds.has(itemId) || normalizedPrice === null || current.coins < normalizedPrice) {
    return null;
  }

  const next: AppSaveState = {
    ...current,
    coins: current.coins - normalizedPrice,
    items: {
      ...current.items,
      [itemId]: (current.items[itemId] ?? 0) + 1,
    },
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** 次の捕獲や対戦で自動使用する消耗アイテムを1つ減らします。 */
export function consumeShopItem(itemId: string, count = 1): AppSaveState | null {
  const normalizedCount = normalizePositiveInteger(count);
  const current = loadSaveState();
  const currentCount = current.items[itemId] ?? 0;
  if (!knownShopItemIds.has(itemId) || normalizedCount === null || currentCount < normalizedCount) {
    return null;
  }

  const nextItems = {
    ...current.items,
    [itemId]: currentCount - normalizedCount,
  };
  if (nextItems[itemId] <= 0) {
    delete nextItems[itemId];
  }

  const next: AppSaveState = {
    ...current,
    items: nextItems,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

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
function getFinalEvolutionMonsterId(monsterId: string): string {
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

/** コインでタイトル背景を購入し、購入済みなら選択だけを行います。 */
export function buyTitleBackground(backgroundId: string): AppSaveState | null {
  if (!knownTitleBackgroundIds.has(backgroundId)) {
    return null;
  }

  const current = loadSaveState();
  const background = getTitleBackgroundById(backgroundId);
  if (isTitleBackgroundOwned(current, background.id)) {
    return selectTitleBackground(background.id);
  }

  if (background.price <= 0 || current.coins < background.price) {
    return null;
  }

  const nextOwnedTitleBackgroundIds = normalizeTitleBackgroundIds([
    ...current.ownedTitleBackgroundIds,
    background.id,
  ]);
  const next: AppSaveState = {
    ...current,
    coins: current.coins - background.price,
    ownedTitleBackgroundIds: nextOwnedTitleBackgroundIds,
    selectedTitleBackgroundId: background.id,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** 所持済みのタイトル背景を選択状態として保存します。 */
export function selectTitleBackground(backgroundId: string): AppSaveState | null {
  if (!knownTitleBackgroundIds.has(backgroundId)) {
    return null;
  }

  const current = loadSaveState();
  if (!isTitleBackgroundOwned(current, backgroundId)) {
    return null;
  }

  const next: AppSaveState = {
    ...current,
    selectedTitleBackgroundId: backgroundId,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}

/** タイトル編集画面で調整したモンスター配置を保存します。 */
export function saveTitleMonsterPlacements(
  placements: TitleMonsterPlacementState[],
): AppSaveState | null {
  const current = loadSaveState();
  const capturedPlacements = normalizeTitleMonsterPlacements(placements)
    .filter((placement) => getMonsterCaptureCount(current, placement.monsterId) > 0);
  const placedMonsterIds: Array<string | null> = capturedPlacements.map((placement) => placement.monsterId);
  const titleMonsterIds = placedMonsterIds
    .concat(Array.from<string | null>({ length: TITLE_MONSTER_SLOT_COUNT }).fill(null))
    .slice(0, TITLE_MONSTER_SLOT_COUNT);

  const next: AppSaveState = {
    ...current,
    titleMonsterIds: titleMonsterIds.some((monsterId) => monsterId !== null) ? titleMonsterIds : [],
    titleMonsterPlacements: capturedPlacements,
  };

  if (!saveState(next)) {
    return null;
  }

  return next;
}
