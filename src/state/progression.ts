import { achievements } from '../data/achievements';
import { getMonsterById, getPrimaryStageIdForMonsterId } from '../data/monsters';
import { shopItems } from '../data/shopItems';
import { getStageById } from '../data/stages';
import { trainers } from '../data/trainers';
import { AppSaveState, StageAvailability, StageDefinition, StageId, StageUnlockCondition } from '../game/types';
import {
  getBattleWinCount,
  getItemCount,
  getMonsterCaptureCount,
  getStageCaptureCount,
  getUniqueCaptureCount,
} from './save';

const achievementById = new Map(achievements.map((achievement) => [achievement.id, achievement]));
const shopItemById = new Map<string, (typeof shopItems)[number]>(shopItems.map((item) => [item.id, item]));
const trainerById = new Map(trainers.map((trainer) => [trainer.id, trainer]));

export interface StageUnlockConditionDetail {
  label: string;
  statusLabel: string;
  isMet: boolean;
  helperLabel?: string;
  targetStageId?: StageId;
}

/** ステージ定義から解放条件を取り出し、未指定なら空配列にします。 */
export function getStageUnlockConditions(stage: StageDefinition): StageUnlockCondition[] {
  return stage.unlockConditions ?? [];
}

/** 指定トロフィーが現在の保存状態で達成済みかどうかを判定します。 */
function isAchievementUnlocked(saveState: AppSaveState, achievementId: string): boolean {
  return achievements.some((achievement) => achievement.id === achievementId && achievement.isUnlocked(saveState));
}

/** 解放条件の必要数を正の整数へ整え、不正ならnullにします。 */
function getPositiveConditionCount(count: number | undefined): number | null {
  const requiredCount = count ?? 1;
  if (!Number.isFinite(requiredCount) || requiredCount <= 0) {
    return null;
  }

  return Math.floor(requiredCount);
}

/** 解放条件の種類ごとに、現在の保存状態で達成済みかを判定します。 */
function isUnlockConditionMet(condition: StageUnlockCondition, saveState: AppSaveState): boolean {
  if (condition.type === 'stageClearCount') {
    const requiredCount = getPositiveConditionCount(condition.count);
    return requiredCount !== null && getStageCaptureCount(saveState, condition.stageId) >= requiredCount;
  }

  if (condition.type === 'uniqueDexCount') {
    const requiredCount = getPositiveConditionCount(condition.count);
    return requiredCount !== null && getUniqueCaptureCount(saveState) >= requiredCount;
  }

  if (condition.type === 'monsterCaptured') {
    return getMonsterCaptureCount(saveState, condition.monsterId) > 0;
  }

  if (condition.type === 'achievementUnlocked') {
    return isAchievementUnlocked(saveState, condition.achievementId);
  }

  if (condition.type === 'itemOwned') {
    const requiredCount = getPositiveConditionCount(condition.count);
    return requiredCount !== null && getItemCount(saveState, condition.itemId) >= requiredCount;
  }

  if (condition.type === 'trainerDefeated') {
    const requiredCount = getPositiveConditionCount(condition.count);
    return requiredCount !== null && getBattleWinCount(saveState, condition.trainerId) >= requiredCount;
  }

  return false;
}

/** ステージが公開前・ロック中・プレイ可能のどれかを返します。 */
export function getStageAvailability(
  stage: StageDefinition,
  saveState: AppSaveState,
): StageAvailability {
  if (stage.comingSoon) {
    return 'comingSoon';
  }

  if (getStageUnlockConditions(stage).some((condition) => !isUnlockConditionMet(condition, saveState))) {
    return 'locked';
  }

  return 'available';
}

/** 解放条件を、ステージ選択画面に出す説明文へ変換します。 */
function getUnlockConditionLabel(condition: StageUnlockCondition): string {
  if (condition.label) {
    return condition.label;
  }

  if (condition.type === 'stageClearCount') {
    return `${getStageById(condition.stageId).name}を ${condition.count}かい クリア`;
  }

  if (condition.type === 'uniqueDexCount') {
    return `ずかんを ${condition.count}ひきまで うめる`;
  }

  if (condition.type === 'monsterCaptured') {
    const monster = getMonsterById(condition.monsterId);
    if (monster.previousEvolutionId) {
      return `${getMonsterById(monster.previousEvolutionId).name}をしんかさせる`;
    }

    return `${monster.name}をゲットする`;
  }

  if (condition.type === 'achievementUnlocked') {
    return `${achievementById.get(condition.achievementId)?.title ?? condition.achievementId}を あける`;
  }

  if (condition.type === 'itemOwned') {
    return `${shopItemById.get(condition.itemId)?.name ?? condition.itemId}を てにいれる`;
  }

  if (condition.type === 'trainerDefeated') {
    return `たいせんで${trainerById.get(condition.trainerId)?.name ?? condition.trainerId}をたおす`;
  }

  return '';
}

/** 解放条件の現在の進み具合を、短い状態文へ変換します。 */
function getUnlockConditionStatusLabel(condition: StageUnlockCondition, saveState: AppSaveState): string {
  if (isUnlockConditionMet(condition, saveState)) {
    return 'たっせい！';
  }

  if (condition.type === 'stageClearCount') {
    const remainingCount = Math.max(0, condition.count - getStageCaptureCount(saveState, condition.stageId));
    return `あと${remainingCount}かい`;
  }

  if (condition.type === 'uniqueDexCount') {
    const remainingCount = Math.max(0, condition.count - getUniqueCaptureCount(saveState));
    return `あと${remainingCount}ひき`;
  }

  if (condition.type === 'monsterCaptured') {
    const monster = getMonsterById(condition.monsterId);
    if (monster.previousEvolutionId) {
      const sourceMonster = getMonsterById(monster.previousEvolutionId);
      return getMonsterCaptureCount(saveState, sourceMonster.id) > 0
        ? `${sourceMonster.name}をしんかさせよう`
        : `${sourceMonster.name}をゲットしにいこう`;
    }

    return `${monster.name}をゲットしにいこう`;
  }

  if (condition.type === 'achievementUnlocked') {
    const achievement = achievementById.get(condition.achievementId);
    if (!achievement) {
      return 'まだたっせいしていないよ';
    }

    const progress = achievement.getProgress(saveState);
    const remainingCount = Math.max(0, progress.target - progress.current);
    return remainingCount > 0 ? `あと${remainingCount}こ` : 'まだたっせいしていないよ';
  }

  if (condition.type === 'itemOwned') {
    const requiredCount = getPositiveConditionCount(condition.count);
    const remainingCount = requiredCount === null ? 0 : Math.max(0, requiredCount - getItemCount(saveState, condition.itemId));
    return remainingCount > 0 ? `あと${remainingCount}こ` : 'まだたっせいしていないよ';
  }

  if (condition.type === 'trainerDefeated') {
    const requiredCount = getPositiveConditionCount(condition.count);
    const remainingCount = requiredCount === null ? 0 : Math.max(0, requiredCount - getBattleWinCount(saveState, condition.trainerId));
    return remainingCount > 0 ? `あと${remainingCount}かい` : 'まだたっせいしていないよ';
  }

  return 'まだたっせいしていないよ';
}

/** 解放条件ごとの説明・状態・案内先ステージをまとめて返します。 */
export function getStageUnlockDetails(
  stage: StageDefinition,
  saveState: AppSaveState,
): StageUnlockConditionDetail[] {
  return getStageUnlockConditions(stage).map((condition) => {
    const detail: StageUnlockConditionDetail = {
      label: getUnlockConditionLabel(condition),
      statusLabel: getUnlockConditionStatusLabel(condition, saveState),
      isMet: isUnlockConditionMet(condition, saveState),
    };

    if (condition.type === 'monsterCaptured') {
      const monster = getMonsterById(condition.monsterId);
      const guideMonster = monster.previousEvolutionId ? getMonsterById(monster.previousEvolutionId) : monster;
      const guideStageId = getPrimaryStageIdForMonsterId(guideMonster.id);
      if (!guideStageId) {
        return detail;
      }

      const guideStage = getStageById(guideStageId);
      return {
        ...detail,
        helperLabel: `${guideMonster.name}は ${guideStage.name}で あえるよ`,
        targetStageId: guideStage.id,
      };
    }

    return detail;
  });
}
