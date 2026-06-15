import { SHOP_ITEM_IDS } from '../../data/shopItems';
import { AppSaveState } from '../../game/types';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

type DailyLoginReward = {
  rewardCoins: number;
  rewardItemId: string | null;
  rewardItemCount: number;
};

/** `YYYY-MM-DD`形式かつ実在する日付かを確認します。 */
export function isValidDateKey(dateKey: string): boolean {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    return false;
  }

  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/** 保存されたログインボーナス状態を、安全な数値と日付だけに整えます。 */
export function normalizeDailyLoginState(value: unknown): AppSaveState['dailyLogin'] {
  if (!value || typeof value !== 'object') {
    return {
      lastClaimedDate: null,
      streakDays: 0,
      totalClaimDays: 0,
    };
  }

  const rawLastClaimedDate = (value as Partial<AppSaveState['dailyLogin']>).lastClaimedDate;
  const rawStreakDays = (value as Partial<AppSaveState['dailyLogin']>).streakDays;
  const rawTotalClaimDays = (value as Partial<AppSaveState['dailyLogin']>).totalClaimDays;

  return {
    lastClaimedDate:
      typeof rawLastClaimedDate === 'string' && isValidDateKey(rawLastClaimedDate)
        ? rawLastClaimedDate
        : null,
    streakDays: typeof rawStreakDays === 'number' && Number.isFinite(rawStreakDays) && rawStreakDays > 0
      ? Math.floor(rawStreakDays)
      : 0,
    totalClaimDays:
      typeof rawTotalClaimDays === 'number' && Number.isFinite(rawTotalClaimDays) && rawTotalClaimDays > 0
        ? Math.floor(rawTotalClaimDays)
        : 0,
  };
}

/** 端末のローカル日付を、保存比較用の`YYYY-MM-DD`文字列にします。 */
export function getLocalDateKey(now = Date.now()): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 日付キーを日単位の番号に変換し、前日かどうかの判定に使います。 */
export function getDateKeyDayIndex(dateKey: string | null): number | null {
  if (!dateKey || !isValidDateKey(dateKey)) {
    return null;
  }

  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** 今日受け取った場合の連続ログイン日数を、前回日付から計算します。 */
export function getNextLoginStreakDays(state: AppSaveState, todayKey: string): number {
  if (state.dailyLogin.lastClaimedDate === todayKey) {
    return state.dailyLogin.streakDays;
  }

  const lastClaimedDayIndex = getDateKeyDayIndex(state.dailyLogin.lastClaimedDate);
  const todayDayIndex = getDateKeyDayIndex(todayKey);
  if (lastClaimedDayIndex !== null && todayDayIndex !== null && lastClaimedDayIndex > todayDayIndex) {
    return state.dailyLogin.streakDays;
  }

  if (lastClaimedDayIndex !== null && todayDayIndex !== null && todayDayIndex - lastClaimedDayIndex === 1) {
    return state.dailyLogin.streakDays + 1;
  }

  return 1;
}

/** ログインボーナスの報酬内容を、画面表示用の短い文字列にします。 */
export function getDailyLoginRewardLabel(status: DailyLoginReward): string {
  if (status.rewardItemId === SHOP_ITEM_IDS.rareBell && status.rewardItemCount > 0) {
    return `${status.rewardCoins}コイン + レアベル${status.rewardItemCount}こ`;
  }

  return `${status.rewardCoins}コイン`;
}
