import {
  DAILY_MISSION_ALL_CLEAR_REWARD,
  DailyMissionDefinition,
  DailyMissionReward,
  dailyMissions,
  getDailyMissionRewardLabel,
} from '../../data/dailyMissions';
import { SHOP_ITEM_IDS } from '../../data/shopItems';
import { AppSaveState } from '../../game/types';
import { DAILY_LOGIN_COIN_REWARDS } from './constants';
import {
  getDailyLoginRewardLabel,
  getDateKeyDayIndex,
  getLocalDateKey,
  getNextLoginStreakDays,
} from './dailyLogin';
import { getDailyMissionStateForToday } from './dailyMission';
import { loadSaveState, saveState } from './storage';

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
  const totalClaimDays = canClaim ? state.dailyLogin.totalClaimDays + 1 : state.dailyLogin.totalClaimDays;
  // Use all claimed days so a missed day never resets the reward cycle.
  const cycleDay = ((Math.max(1, totalClaimDays) - 1) % DAILY_LOGIN_COIN_REWARDS.length) + 1;
  const rewardCoins = DAILY_LOGIN_COIN_REWARDS[cycleDay - 1];
  const rewardItemId = cycleDay === DAILY_LOGIN_COIN_REWARDS.length ? SHOP_ITEM_IDS.rareBell : null;
  const rewardItemCount = rewardItemId ? 1 : 0;
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
