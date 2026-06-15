import { monsters } from './monsters';
import { stages } from './stages';
import type { AppSaveState } from '../game/types';
import { getBestStreakWins, getStageCaptureCount, getStageStarRank, getUniqueCaptureCount } from '../state/save';

type AchievementCategory = 'stage-clear' | 'stage-complete' | 'streak' | 'dex';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  isUnlocked: (saveState: AppSaveState) => boolean;
  getProgress: (saveState: AppSaveState) => { current: number; target: number };
}

const stageClearAchievements: AchievementDefinition[] = stages.map((stage) => ({
  id: `stage-clear-${stage.id}`,
  title: `${stage.name} クリア`,
  description: `${stage.name}で はじめて モンスターをつかまえる`,
  category: 'stage-clear',
  isUnlocked: (saveState) => getStageCaptureCount(saveState, stage.id) > 0,
  getProgress: (saveState) => ({
    current: Math.min(1, getStageCaptureCount(saveState, stage.id)),
    target: 1,
  }),
}));

const stageCompleteAchievements: AchievementDefinition[] = stages.map((stage) => ({
  id: `stage-complete-${stage.id}`,
  title: `${stage.name} ぜんぶ`,
  description: `${stage.name}の 星を 5つ あつめる`,
  category: 'stage-complete',
  isUnlocked: (saveState) => getStageStarRank(saveState, stage) >= 5,
  getProgress: (saveState) => ({
    current: getStageStarRank(saveState, stage),
    target: 5,
  }),
}));

const streakThresholds = [1, 3, 5, 9];
const streakAchievements: AchievementDefinition[] = streakThresholds.map((threshold) => ({
  id: `streak-${threshold}`,
  title: `れんぞく ${threshold}にん`,
  description: `れんぞくたいせんで ${threshold}にん とっぱする`,
  category: 'streak',
  isUnlocked: (saveState) => getBestStreakWins(saveState) >= threshold,
  getProgress: (saveState) => ({
    current: Math.min(threshold, getBestStreakWins(saveState)),
    target: threshold,
  }),
}));

const dexThresholds = [5, 10, 20, 40, 60, 80, monsters.length];
const dexAchievements: AchievementDefinition[] = dexThresholds
  .filter((threshold, index, all) => threshold <= monsters.length && all.indexOf(threshold) === index)
  .map((threshold) => ({
    id: `dex-${threshold}`,
    title: `ずかん ${threshold}しゅるい`,
    description: `ずかんに ${threshold}しゅるい とうろくする`,
    category: 'dex',
    isUnlocked: (saveState) => getUniqueCaptureCount(saveState) >= threshold,
    getProgress: (saveState) => ({
      current: Math.min(threshold, getUniqueCaptureCount(saveState)),
      target: threshold,
    }),
  }));

export const achievements: AchievementDefinition[] = [
  ...stageClearAchievements,
  ...stageCompleteAchievements,
  ...streakAchievements,
  ...dexAchievements,
];

/** 現在の保存状態で達成済みのトロフィー数を数えます。 */
export function getUnlockedAchievementCount(saveState: AppSaveState): number {
  let unlockedCount = 0;
  achievements.forEach((achievement) => {
    if (achievement.isUnlocked(saveState)) {
      unlockedCount += 1;
    }
  });

  return unlockedCount;
}
