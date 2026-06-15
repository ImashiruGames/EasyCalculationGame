import type { PracticeLevelId } from '../game/types';

export interface PracticeLevelDefinition {
  id: PracticeLevelId;
  label: string;
  order: number | null;
}

export const DEFAULT_PRACTICE_LEVEL_ID: PracticeLevelId = 'grade2';

export const practiceLevels: PracticeLevelDefinition[] = [
  { id: 'all', label: 'ぜんぶ', order: null },
  { id: 'grade1', label: '1年生', order: 1 },
  { id: 'grade2', label: '2年生', order: 2 },
  { id: 'grade3', label: '3年生', order: 3 },
  { id: 'grade4', label: '4年生', order: 4 },
  { id: 'grade5', label: '5年生', order: 5 },
  { id: 'grade6', label: '6年生', order: 6 },
  { id: 'junior', label: '中学', order: 7 },
  { id: 'junior1', label: '中学1年生', order: 7 },
  { id: 'junior2', label: '中学2年生', order: 8 },
  { id: 'junior3', label: '中学3年生', order: 9 },
];

const practiceLevelIds = new Set<PracticeLevelId>(practiceLevels.map((level) => level.id));
const practiceLevelById = new Map(practiceLevels.map((level) => [level.id, level]));

/** 保存値や外部入力の学年IDを、存在するIDだけに正規化します。 */
export function normalizePracticeLevelId(value: unknown): PracticeLevelId {
  return typeof value === 'string' && practiceLevelIds.has(value as PracticeLevelId)
    ? value as PracticeLevelId
    : DEFAULT_PRACTICE_LEVEL_ID;
}

/** 学年IDから、メニューなどに表示するラベルを返します。 */
export function getPracticeLevelLabel(levelId: PracticeLevelId): string {
  return practiceLevelById.get(levelId)?.label ?? practiceLevelById.get(DEFAULT_PRACTICE_LEVEL_ID)?.label ?? 'ぜんぶ';
}

/** 指定学年が、CSVで決めた最小学年から最大学年の範囲に入るか判定します。 */
export function isPracticeLevelInRange(
  levelId: PracticeLevelId,
  minPracticeLevel: number | undefined,
  maxPracticeLevel: number | undefined,
): boolean {
  const level = practiceLevelById.get(levelId);
  if (!level || level.order === null) {
    return true;
  }

  return level.order >= (minPracticeLevel ?? 0)
    && level.order <= (maxPracticeLevel ?? Number.POSITIVE_INFINITY);
}
