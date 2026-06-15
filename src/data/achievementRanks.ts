import { achievements, getUnlockedAchievementCount } from './achievements';
import type { AppSaveState } from '../game/types';

export type AchievementMedalKind = 'bronze' | 'silver' | 'gold';

export interface AchievementRankDefinition {
  index: number;
  id: string;
  name: string;
  minUnlocked: number;
  medal: AchievementMedalKind;
}

interface RankSeed {
  id: string;
  name: string;
  minUnlocked: number;
  medal: AchievementMedalKind;
}

const totalAchievementCount = achievements.length;

const rankSeeds: RankSeed[] = [
  { id: 'rookie', name: 'かけだし', minUnlocked: 0, medal: 'bronze' },
  { id: 'apprentice', name: 'みならい', minUnlocked: 3, medal: 'bronze' },
  { id: 'bronze', name: 'ブロンズ', minUnlocked: 7, medal: 'bronze' },
  { id: 'silver', name: 'シルバー', minUnlocked: 12, medal: 'silver' },
  { id: 'gold', name: 'ゴールド', minUnlocked: 18, medal: 'gold' },
  { id: 'champion', name: 'チャンピオン', minUnlocked: 25, medal: 'gold' },
  { id: 'master', name: 'マスター', minUnlocked: totalAchievementCount, medal: 'gold' },
];

export const achievementRanks: AchievementRankDefinition[] = rankSeeds
  .filter((rank) => rank.id === 'master' || rank.minUnlocked < totalAchievementCount)
  .map((rank, index) => ({ ...rank, index }));

/** 解放済みトロフィー数から、現在のランクを返します。 */
export function getAchievementRank(unlockedCount: number): AchievementRankDefinition {
  const normalizedCount = Math.max(0, Math.floor(unlockedCount));
  for (let index = achievementRanks.length - 1; index >= 0; index -= 1) {
    const rank = achievementRanks[index];
    if (normalizedCount >= rank.minUnlocked) {
      return rank;
    }
  }

  return achievementRanks[0];
}

/** 保存データの達成状況を数え、今のトロフィーランクへ変換します。 */
export function getAchievementRankForSave(saveState: AppSaveState): AchievementRankDefinition {
  return getAchievementRank(getUnlockedAchievementCount(saveState));
}

/** 次のランクがある場合は、その条件を返します。 */
export function getNextAchievementRank(currentRank: AchievementRankDefinition): AchievementRankDefinition | null {
  return achievementRanks[currentRank.index + 1] ?? null;
}
