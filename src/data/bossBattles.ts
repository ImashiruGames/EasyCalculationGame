import { getMonsterById } from './monsters';
import { getStageById, getStageCategoryById, getStagesByCategoryId } from './stages';
import { BossBattleDefinition, ProblemRuleDefinition, StageDefinition, StageId, TrainerDefinition } from '../game/types';
import bossBattlesCsv from './csv/boss_battles.csv?raw';
import debugBossBattlesCsv from './csv/debug_boss_battles.csv?raw';
import {
  optionalCsvValue,
  parseCsv,
  parseCsvList,
  parseCsvNumber,
  parseOptionalCsvNumber,
  requireCsvValue,
} from './csv';
import { appendDebugCsvRows } from './debugMode';

const STAGES_PER_BOSS_PAGE = 3;
export const BOSS_BATTLE_DISPLAY_NAME = 'ボスとたたかう！';
export const BOSS_BATTLE_OPPONENT_NAME = 'ボス';

/** CSVの問題ルールを、JSON形式なら構造化し、通常文字列ならそのままルールIDにします。 */
function parseProblemRule(value: string): ProblemRuleDefinition {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as ProblemRuleDefinition;
  }

  return trimmed as ProblemRuleDefinition;
}

/** CSVのページ指定を読み、未指定なら全ページ用のボスとして扱います。 */
function parsePageIndex(row: Record<string, string>, rowNumber: number): number | undefined {
  const pageIndex = parseOptionalCsvNumber(row, 'pageIndex', rowNumber);
  if (pageIndex === undefined) {
    return undefined;
  }
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new Error(`CSV row ${rowNumber} column "pageIndex" must be an integer greater than or equal to 0.`);
  }

  return pageIndex;
}

/** CSVに指定された元ステージを読み、未指定なら画面側から渡されるステージを使えるよう空配列にします。 */
function parseSourceStages(row: Record<string, string>, rowNumber: number): StageDefinition[] {
  const sourceStageIds = parseCsvList(row.sourceStageIds);
  const fallbackStageId = optionalCsvValue(row.stageId);
  const stageIds = sourceStageIds.length > 0
    ? sourceStageIds
    : fallbackStageId
      ? [fallbackStageId]
      : [];

  if (stageIds.length > 5) {
    throw new Error(`CSV row ${rowNumber} column "sourceStageIds" must list 1 to 5 stages.`);
  }

  return stageIds.map((stageId) => getStageById(stageId as StageId));
}

/** カテゴリ内の代表ステージを返し、ボス定義のステージIDが空でも通常バトル処理に渡せるようにします。 */
function getFallbackStageForCategory(categoryId: string, rowNumber: number): StageDefinition {
  const stage = getStagesByCategoryId(categoryId)[0];
  if (!stage) {
    throw new Error(`CSV row ${rowNumber} category "${categoryId}" must have at least one stage.`);
  }

  return stage;
}

/** ボス戦でランダム出題に使う問題形式数を読み、元ステージ数と合わせて1から5問の範囲に制限します。 */
function parseProblemCount(row: Record<string, string>, rowNumber: number, fallbackCount: number): number {
  const problemCount = parseOptionalCsvNumber(row, 'problemCount', rowNumber) ?? fallbackCount;
  if (!Number.isInteger(problemCount) || problemCount < 1 || problemCount > 5) {
    throw new Error(`CSV row ${rowNumber} column "problemCount" must be an integer between 1 and 5.`);
  }

  return problemCount;
}

/** CSVの1行を、ボス戦で使う定義へ変換します。 */
function parseBossBattle(row: Record<string, string>, index: number): BossBattleDefinition {
  const rowNumber = index + 2;
  const sourceStages = parseSourceStages(row, rowNumber);
  const categoryId = optionalCsvValue(row.categoryId) ?? sourceStages[0]?.stageCategoryId;
  if (!categoryId) {
    throw new Error(`CSV row ${rowNumber} must set "categoryId" when "sourceStageIds" and "stageId" are empty.`);
  }
  getStageCategoryById(categoryId);
  const fallbackStage = sourceStages[0] ?? getFallbackStageForCategory(categoryId, rowNumber);
  const stageId = optionalCsvValue(row.stageId) ?? fallbackStage.id;
  const bossMonsterId = requireCsvValue(row, 'bossMonsterId', rowNumber);
  const bossMonster = getMonsterById(bossMonsterId);
  const bossMonsterIds = parseCsvList(row.bossMonsterIds);
  bossMonsterIds.forEach((monsterId) => getMonsterById(monsterId));
  const pageIndex = parsePageIndex(row, rowNumber);
  const problemRuleOverride = optionalCsvValue(row.problemRule);
  const parsedProblemRuleOverride = problemRuleOverride ? parseProblemRule(problemRuleOverride) : null;
  const problemCount = parseProblemCount(row, rowNumber, sourceStages.length || STAGES_PER_BOSS_PAGE);
  if (!parsedProblemRuleOverride && sourceStages.length > 0 && problemCount > sourceStages.length) {
    throw new Error(`CSV row ${rowNumber} column "problemCount" is larger than "sourceStageIds".`);
  }
  const problemRules = parsedProblemRuleOverride
    ? Array.from({ length: problemCount }, () => parsedProblemRuleOverride)
    : sourceStages.slice(0, problemCount).map((stage) => stage.problemRule);

  return {
    id: requireCsvValue(row, 'id', rowNumber),
    name: requireCsvValue(row, 'name', rowNumber),
    title: requireCsvValue(row, 'title', rowNumber),
    categoryId,
    pageIndex,
    stageId,
    sourceStageIds: sourceStages.slice(0, problemCount).map((stage) => stage.id),
    difficultyLevel: parseCsvNumber(row, 'difficultyLevel', rowNumber),
    hp: parseCsvNumber(row, 'hp', rowNumber),
    problemRule: problemRules[0] ?? fallbackStage.problemRule,
    problemRules,
    problemCount,
    bossMonsterId,
    bossMonsterIds: bossMonsterIds.length > 0 ? bossMonsterIds : undefined,
    rewardCoins: parseCsvNumber(row, 'rewardCoins', rowNumber),
    rewardCandyAttribute: optionalCsvValue(row.rewardCandyAttribute),
    rewardCandyAmount: parseOptionalCsvNumber(row, 'rewardCandyAmount', rowNumber),
    accentColor: requireCsvValue(row, 'accentColor', rowNumber),
    palette: {
      background: optionalCsvValue(row.paletteBackground) ?? bossMonster.palette.background,
    },
  };
}

export const bossBattles: BossBattleDefinition[] = parseCsv(
  appendDebugCsvRows(bossBattlesCsv, debugBossBattlesCsv),
).map(parseBossBattle);

const bossBattleById = new Map(bossBattles.map((bossBattle) => [bossBattle.id, bossBattle]));
const bossBattlesByCategoryId = new Map<string, BossBattleDefinition[]>();

bossBattles.forEach((bossBattle) => {
  const categoryBosses = bossBattlesByCategoryId.get(bossBattle.categoryId) ?? [];
  categoryBosses.push(bossBattle);
  bossBattlesByCategoryId.set(bossBattle.categoryId, categoryBosses);
});

/** ボス定義から、相手パーティとして出すモンスターIDを返します。 */
export function getBossBattleMonsterIds(bossBattle: BossBattleDefinition): string[] {
  return bossBattle.bossMonsterIds?.length ? bossBattle.bossMonsterIds : [bossBattle.bossMonsterId];
}

/** カテゴリIDから、そのステージ一覧に置くボス定義をCSV順で返します。 */
export function getBossBattlesByCategoryId(categoryId: string): BossBattleDefinition[] {
  return bossBattlesByCategoryId.get(categoryId) ?? [];
}

/** カテゴリとステージページから、専用設定があればそれを、なければ共通ボスを返します。 */
export function getBossBattleForStagePage(categoryId: string, pageIndex: number): BossBattleDefinition | null {
  const categoryBosses = getBossBattlesByCategoryId(categoryId);
  return categoryBosses.find((bossBattle) => bossBattle.pageIndex === pageIndex)
    ?? categoryBosses.find((bossBattle) => bossBattle.pageIndex === undefined)
    ?? categoryBosses[0]
    ?? null;
}

/** ボス勝利数をページごとに分けて保存するためのIDを返します。 */
export function getBossBattleSaveId(bossBattle: BossBattleDefinition, pageIndex?: number): string {
  const resolvedPageIndex = pageIndex ?? bossBattle.pageIndex;
  return resolvedPageIndex === undefined ? bossBattle.id : `${bossBattle.id}-page-${resolvedPageIndex + 1}`;
}

/** 保存データの正規化で残してよい、通常ボスIDとページ別ボスIDをまとめて返します。 */
export function getAllBossBattleSaveIds(): string[] {
  const saveIds = new Set<string>();
  bossBattles.forEach((bossBattle) => {
    saveIds.add(bossBattle.id);
    if (bossBattle.pageIndex !== undefined) {
      saveIds.add(getBossBattleSaveId(bossBattle));
    }
  });

  new Set(bossBattles.map((bossBattle) => bossBattle.categoryId)).forEach((categoryId) => {
    const maxPageIndex = Math.max(0, Math.ceil(getStagesByCategoryId(categoryId).length / STAGES_PER_BOSS_PAGE) - 1);
    for (let pageIndex = 0; pageIndex <= maxPageIndex; pageIndex += 1) {
      const bossBattle = getBossBattleForStagePage(categoryId, pageIndex);
      if (bossBattle) {
        saveIds.add(getBossBattleSaveId(bossBattle, pageIndex));
      }
    }
  });

  return [...saveIds];
}

/** ボス戦のランダム出題に使う、元ステージごとの問題ルールを返します。 */
export function getBossBattleProblemRules(
  bossBattle: BossBattleDefinition,
  sourceStageIds: StageId[] = [],
): ProblemRuleDefinition[] {
  if (sourceStageIds.length > 0) {
    return sourceStageIds.slice(0, 5).map((stageId) => getStageById(stageId).problemRule);
  }

  if (bossBattle.problemRules.length > 0) {
    return bossBattle.problemRules;
  }

  const stageRules = bossBattle.sourceStageIds.slice(0, 5).map((stageId) => getStageById(stageId).problemRule);
  if (stageRules.length > 0) {
    return stageRules;
  }

  const fallbackStart = (bossBattle.pageIndex ?? 0) * STAGES_PER_BOSS_PAGE;
  const categoryStageRules = getStagesByCategoryId(bossBattle.categoryId)
    .slice(fallbackStart, fallbackStart + bossBattle.problemCount)
    .map((stage) => stage.problemRule);
  if (categoryStageRules.length > 0) {
    return categoryStageRules;
  }

  return [bossBattle.problemRule];
}

/** ボスIDから定義を取得し、見つからない場合はデータ不備として止めます。 */
export function getBossBattleById(bossBattleId: string): BossBattleDefinition {
  const bossBattle = bossBattleById.get(bossBattleId);
  if (!bossBattle) {
    throw new Error(`Unknown boss battle id: ${bossBattleId}`);
  }

  return bossBattle;
}

/** 既存のバトル処理へ渡すため、ボス定義をトレーナー相当の形へ変換します。 */
export function getBossBattleAsTrainer(bossBattleId: string, pageIndex?: number): TrainerDefinition {
  const bossBattle = getBossBattleById(bossBattleId);
  return {
    id: getBossBattleSaveId(bossBattle, pageIndex),
    name: BOSS_BATTLE_OPPONENT_NAME,
    title: bossBattle.title,
    stageId: bossBattle.stageId,
    difficultyLevel: bossBattle.difficultyLevel,
    hp: bossBattle.hp,
    problemRule: bossBattle.problemRule,
    partnerMonsterId: bossBattle.bossMonsterId,
    partnerMonsterIds: getBossBattleMonsterIds(bossBattle),
    rewardCoins: bossBattle.rewardCoins,
    rewardCandyAttribute: bossBattle.rewardCandyAttribute,
    rewardCandyAmount: bossBattle.rewardCandyAmount,
    accentColor: bossBattle.accentColor,
    palette: {
      cap: bossBattle.accentColor,
      shirt: bossBattle.accentColor,
      shadow: '#243044',
      background: bossBattle.palette.background,
    },
  };
}
