import { AppSaveState, DailyMissionState } from '../../game/types';
import { getLocalDateKey, isValidDateKey } from './dailyLogin';

/** 指定日のデイリーミッション進行を、すべて0の状態で作ります。 */
export function createEmptyDailyMissionState(dateKey = getLocalDateKey()): DailyMissionState {
  return {
    dateKey,
    stageEntries: 0,
    captures: 0,
    battleWins: 0,
    claimedMissionIds: [],
    allClearClaimed: false,
  };
}

/** 保存されたデイリーミッション状態を、今日の分だけ安全な形に整えます。 */
export function normalizeDailyMissionState(value: unknown, todayKey = getLocalDateKey()): DailyMissionState {
  if (!value || typeof value !== 'object') {
    return createEmptyDailyMissionState(todayKey);
  }

  const rawState = value as Partial<DailyMissionState>;
  if (typeof rawState.dateKey !== 'string' || !isValidDateKey(rawState.dateKey) || rawState.dateKey !== todayKey) {
    return createEmptyDailyMissionState(todayKey);
  }

  const normalizeCount = (count: unknown): number => (
    typeof count === 'number' && Number.isFinite(count) && count > 0
      ? Math.floor(count)
      : 0
  );
  const claimedMissionIds = Array.isArray(rawState.claimedMissionIds)
    ? Array.from(new Set(rawState.claimedMissionIds.filter((id): id is string => typeof id === 'string')))
    : [];

  return {
    dateKey: rawState.dateKey,
    stageEntries: normalizeCount(rawState.stageEntries),
    captures: normalizeCount(rawState.captures),
    battleWins: normalizeCount(rawState.battleWins),
    claimedMissionIds,
    allClearClaimed: rawState.allClearClaimed === true,
  };
}

/** 保存データから今日のミッション状態を取り出し、日付が違えば初期化します。 */
export function getDailyMissionStateForToday(
  state: AppSaveState,
  now = Date.now(),
): DailyMissionState {
  return normalizeDailyMissionState(state.dailyMissions, getLocalDateKey(now));
}

/** ステージ入場・捕獲・勝利など、指定したデイリー進行数を増やします。 */
export function incrementDailyMissionCounter(
  state: AppSaveState,
  counter: 'stageEntries' | 'captures' | 'battleWins',
  amount = 1,
  now = Date.now(),
): AppSaveState {
  const dailyMissions = getDailyMissionStateForToday(state, now);
  return {
    ...state,
    dailyMissions: {
      ...dailyMissions,
      [counter]: dailyMissions[counter] + Math.max(0, Math.floor(amount)),
    },
  };
}
