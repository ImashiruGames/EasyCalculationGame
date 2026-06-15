import type { PracticeLevelId, StageCategoryDefinition, StageDefinition, StageId } from '../game/types';
import debugStageCategoriesCsv from './csv/debug_stage_categories.csv?raw';
import debugStageMonstersCsv from './csv/debug_stage_monsters.csv?raw';
import debugStageProblemRulesCsv from './csv/debug_stage_problem_rules.csv?raw';
import debugStagesCsv from './csv/debug_stages.csv?raw';
import stageCategoriesCsv from './csv/stage_categories.csv?raw';
import stageMonstersCsv from './csv/stage_monsters.csv?raw';
import stageProblemRulesCsv from './csv/stage_problem_rules.csv?raw';
import stageUnlockConditionsCsv from './csv/stage_unlock_conditions.csv?raw';
import stagesCsv from './csv/stages.csv?raw';
import { appendDebugCsvRows, DEBUG_STAGE_CATEGORY_ID, isDebugModeEnabled } from './debugMode';
import { isPracticeLevelInRange } from './practiceLevels';
import { loadStageCsvData } from './stageCsvLoader';
import { normalizeStageId } from './stageIdAliases';

const stageCsvData = loadStageCsvData({
  stageCategories: appendDebugCsvRows(stageCategoriesCsv, debugStageCategoriesCsv),
  stages: appendDebugCsvRows(stagesCsv, debugStagesCsv),
  stageProblemRules: appendDebugCsvRows(stageProblemRulesCsv, debugStageProblemRulesCsv),
  stageMonsters: appendDebugCsvRows(stageMonstersCsv, debugStageMonstersCsv),
  stageUnlockConditions: stageUnlockConditionsCsv,
});

export const stageCategories: StageCategoryDefinition[] = stageCsvData.stageCategories;
export const stages: StageDefinition[] = stageCsvData.stages;

const stageById = new Map(stages.map((stage) => [stage.id, stage]));
const stageCategoryById = new Map(stageCategories.map((category) => [category.id, category]));
const stagesByCategoryId = new Map<string, StageDefinition[]>();

stages.forEach((stage) => {
  const categoryStages = stagesByCategoryId.get(stage.stageCategoryId) ?? [];
  categoryStages.push(stage);
  stagesByCategoryId.set(stage.stageCategoryId, categoryStages);
});

/** ステージIDから定義を取得し、CSV側の不整合があればすぐ分かるようにします。 */
export function getStageById(stageId: StageId): StageDefinition {
  const currentStageId = normalizeStageId(stageId);
  const stage = stageById.get(currentStageId);
  if (!stage) {
    throw new Error(`Unknown stage id: ${stageId}`);
  }

  return stage;
}

/** カテゴリIDからステージカテゴリ定義を取得します。 */
export function getStageCategoryById(categoryId: string): StageCategoryDefinition {
  const category = stageCategoryById.get(categoryId);
  if (!category) {
    throw new Error(`Unknown stage category id: ${categoryId}`);
  }

  return category;
}

/** 指定カテゴリに属するステージを、CSV上の並び順のまま返します。 */
export function getStagesByCategoryId(categoryId: string): StageDefinition[] {
  return stagesByCategoryId.get(categoryId) ?? [];
}

/** 今の学年表示で、そのカテゴリを出してよいかを判定します。 */
function isCategoryVisibleForPracticeLevel(category: StageCategoryDefinition, levelId: PracticeLevelId): boolean {
  if (category.id === DEBUG_STAGE_CATEGORY_ID) {
    return isDebugModeEnabled();
  }

  return isPracticeLevelInRange(levelId, category.minPracticeLevel, category.maxPracticeLevel);
}

/** カテゴリ設定とステージ個別設定を合わせて、表示対象のステージか判定します。 */
function isStageVisibleForPracticeLevel(
  stage: StageDefinition,
  category: StageCategoryDefinition,
  levelId: PracticeLevelId,
): boolean {
  return isPracticeLevelInRange(
    levelId,
    stage.minPracticeLevel ?? category.minPracticeLevel,
    stage.maxPracticeLevel ?? category.maxPracticeLevel,
  );
}

/** 学年表示に合うステージだけを、指定カテゴリ内から返します。 */
export function getVisibleStagesByCategoryId(categoryId: string, levelId: PracticeLevelId): StageDefinition[] {
  const category = getStageCategoryById(categoryId);
  if (!isCategoryVisibleForPracticeLevel(category, levelId)) {
    return [];
  }

  return getStagesByCategoryId(categoryId).filter((stage) => (
    isStageVisibleForPracticeLevel(stage, category, levelId)
  ));
}

/** 学年表示に合い、かつ中に表示ステージがあるカテゴリだけを返します。 */
export function getVisibleStageCategories(levelId: PracticeLevelId): StageCategoryDefinition[] {
  return stageCategories.filter((category) => (
    category.id !== DEBUG_STAGE_CATEGORY_ID
    && isCategoryVisibleForPracticeLevel(category, levelId)
    && getVisibleStagesByCategoryId(category.id, levelId).length > 0
  ));
}
