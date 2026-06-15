import type { MonsterDefinition } from '../game/types';
import {
  CsvRow,
  optionalCsvValue,
  parseCsv,
  parseCsvList,
  parseOptionalCsvNumber,
  requireCsvValue,
} from './csv';

const EXP_TABLES = {
  fast: [
    { level: 1, totalExp: 0 },
    { level: 2, totalExp: 8 },
    { level: 3, totalExp: 22 },
    { level: 4, totalExp: 44 },
    { level: 5, totalExp: 74 },
    { level: 6, totalExp: 112 },
  ],
  standard: [
    { level: 1, totalExp: 0 },
    { level: 2, totalExp: 10 },
    { level: 3, totalExp: 28 },
    { level: 4, totalExp: 55 },
    { level: 5, totalExp: 92 },
    { level: 6, totalExp: 140 },
  ],
  slow: [
    { level: 1, totalExp: 0 },
    { level: 2, totalExp: 14 },
    { level: 3, totalExp: 36 },
    { level: 4, totalExp: 70 },
    { level: 5, totalExp: 118 },
    { level: 6, totalExp: 180 },
  ],
  rare: [
    { level: 1, totalExp: 0 },
    { level: 2, totalExp: 18 },
    { level: 3, totalExp: 44 },
    { level: 4, totalExp: 84 },
    { level: 5, totalExp: 140 },
    { level: 6, totalExp: 210 },
  ],
};

type ExperienceKind = keyof typeof EXP_TABLES;
type MonsterShape = MonsterDefinition['shape'];
type MonsterPalette = MonsterDefinition['palette'];

interface MonsterCsvEntry {
  row: CsvRow;
  rowNumber: number;
  id: string;
  name: string;
  familyId: string;
  attribute: string;
  experienceKind: ExperienceKind;
  evolutionStage: number;
  attack: number;
  moveNames: string[];
  dexDescription: string;
  isRare: boolean;
  dexStoryEnabled: boolean;
  dexStoryRequiredFragments?: number;
  imageFileName?: string;
  goalGauge?: number;
  hp?: number;
  evolutionRequiredFragments?: number;
}

const BASE_GOAL_GAUGE = 100;
const RARE_GOAL_GAUGE = 200;
const EXPERIENCE_KINDS = new Set<ExperienceKind>(['fast', 'standard', 'slow', 'rare']);
const FALLBACK_SHAPES: MonsterShape[] = [
  'sprout',
  'puff',
  'rabbit',
  'snowball',
  'crystal',
  'seal',
  'ember',
  'spark',
  'coal',
];
const ATTRIBUTE_PALETTES_BY_NAME: Record<string, MonsterPalette> = {
  くさ: { body: '#7fd77b', accent: '#ffcf59', shadow: '#248552', background: '#e8ffe8' },
  こおり: { body: '#9bdcf8', accent: '#ffffff', shadow: '#4d93b3', background: '#e8f8ff' },
  ほのお: { body: '#ff9c6b', accent: '#ffd766', shadow: '#b55334', background: '#fff2e8' },
  かみなり: { body: '#f6d74f', accent: '#ffffff', shadow: '#b79523', background: '#fff9d7' },
  みず: { body: '#70c7ff', accent: '#d8f3ff', shadow: '#3f7db8', background: '#e7f5ff' },
  よる: { body: '#b9a7ff', accent: '#ffe3f1', shadow: '#6a58bd', background: '#f3efff' },
  時計: { body: '#fbf6d4', accent: '#f6bed3', shadow: '#78919a', background: '#dcf5d7' },
  10: { body: '#ffd766', accent: '#fff8bc', shadow: '#b78426', background: '#fff6dd' },
  ひき算: { body: '#8bd889', accent: '#fff0a0', shadow: '#3f8d51', background: '#efffec' },
  もり: { body: '#65bd72', accent: '#d9ffd9', shadow: '#2f7240', background: '#e8ffe6' },
  いし: { body: '#9b958c', accent: '#ffd08a', shadow: '#5c5752', background: '#f6f2ea' },
};
const FALLBACK_PALETTE: MonsterPalette = {
  body: '#ffd766',
  accent: '#fff8bc',
  shadow: '#b78426',
  background: '#fff6dd',
};

/** CSVの文字を真偽値として読み、空欄ならfalseにします。 */
function parseCsvBoolean(row: CsvRow, column: string, rowNumber: number): boolean {
  const value = optionalCsvValue(row[column]);
  if (value === undefined) {
    return false;
  }

  if (['true', '1', 'yes'].includes(value.toLowerCase())) {
    return true;
  }
  if (['false', '0', 'no'].includes(value.toLowerCase())) {
    return false;
  }

  throw new Error(`CSV row ${rowNumber} column "${column}" must be true or false.`);
}

/** 経験値タイプを読み、空欄ならstandardとして使える種類だけを通します。 */
function parseExperienceKind(row: CsvRow, rowNumber: number): ExperienceKind {
  const value = (optionalCsvValue(row.experienceKind) ?? 'standard') as ExperienceKind;
  if (!EXPERIENCE_KINDS.has(value)) {
    throw new Error(`CSV row ${rowNumber} column "experienceKind" is unknown: ${value}`);
  }

  return value;
}

/** 任意の整数列を読み、不正な値ならCSV不備として止めます。 */
function parseOptionalInteger(row: CsvRow, column: string, rowNumber: number): number | undefined {
  const value = parseOptionalCsvNumber(row, column, rowNumber);
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value)) {
    throw new Error(`CSV row ${rowNumber} column "${column}" must be an integer.`);
  }

  return value;
}

/** CSVの1行を、まだ進化前後をつなぐ前のモンスター行へ変換します。 */
function parseMonsterCsvEntry(row: CsvRow, index: number): MonsterCsvEntry {
  const rowNumber = index + 2;
  const id = requireCsvValue(row, 'id', rowNumber);
  const name = requireCsvValue(row, 'name', rowNumber);
  const moveNames = parseCsvList(row.moveNames);

  return {
    row,
    rowNumber,
    id,
    name,
    familyId: optionalCsvValue(row.familyId) ?? id,
    attribute: optionalCsvValue(row.attribute) ?? 'ふつう',
    experienceKind: parseExperienceKind(row, rowNumber),
    evolutionStage: parseOptionalInteger(row, 'evolutionStage', rowNumber) ?? 1,
    attack: parseOptionalInteger(row, 'attack', rowNumber) ?? 10,
    moveNames: moveNames.length > 0 ? moveNames : ['たいあたり'],
    dexDescription: optionalCsvValue(row.dexDescription) ?? `${name}は ふしぎな モンスター。`,
    isRare: parseCsvBoolean(row, 'isRare', rowNumber),
    dexStoryEnabled: parseCsvBoolean(row, 'dexStoryEnabled', rowNumber),
    dexStoryRequiredFragments: parseOptionalInteger(row, 'dexStoryRequiredFragments', rowNumber),
    imageFileName: optionalCsvValue(row.imageFileName),
    goalGauge: parseOptionalInteger(row, 'goalGauge', rowNumber),
    hp: parseOptionalInteger(row, 'hp', rowNumber),
    evolutionRequiredFragments: parseOptionalInteger(row, 'evolutionRequiredFragments', rowNumber),
  };
}

/** 進化段階を読み、1から4までの連番になるよう確認します。 */
function validateFamilyEntries(familyId: string, entries: MonsterCsvEntry[]): MonsterCsvEntry[] {
  if (entries.length < 1 || entries.length > 4) {
    throw new Error(`Monster family "${familyId}" must have 1 to 4 forms.`);
  }

  const sortedEntries = [...entries].sort((a, b) => a.evolutionStage - b.evolutionStage);
  sortedEntries.forEach((entry, index) => {
    if (entry.evolutionStage !== index + 1) {
      throw new Error(`Monster family "${familyId}" must use evolutionStage 1 to ${entries.length}.`);
    }
  });

  return sortedEntries;
}

/** 進化に必要なかけら数を、未指定なら進化段階数から自動で決めます。 */
function getEvolutionRequirement(formCount: number, index: number, override?: number): number | null {
  if (override !== undefined) {
    return override;
  }

  if (formCount === 4) {
    return [4, 9, 16, null][index];
  }
  if (formCount === 3) {
    return [6, 14, null][index];
  }
  if (formCount === 2) {
    return [8, null][index];
  }

  return null;
}

/** 捕獲ゲージ量を、未指定なら経験値タイプと進化段階から計算します。 */
function getGoalGauge(entry: MonsterCsvEntry, formCount: number, index: number): number {
  if (entry.goalGauge !== undefined) {
    return entry.goalGauge;
  }
  if (entry.isRare) {
    return RARE_GOAL_GAUGE;
  }

  const experienceBonus = {
    fast: 0,
    standard: 10,
    slow: 20,
    rare: 40,
  }[entry.experienceKind];
  const evolutionBonus = formCount >= 3 ? index * 30 : index * 40;
  const singleFormBonus = formCount > 1 ? 0 : 10;
  return BASE_GOAL_GAUGE + experienceBonus + evolutionBonus + singleFormBonus;
}

/** 対戦用HPを、未指定なら攻撃力と経験値タイプと進化段階から計算します。 */
function getBattleHp(entry: MonsterCsvEntry, formCount: number, index: number): number {
  if (entry.hp !== undefined) {
    return entry.hp;
  }

  const experienceBonus = {
    fast: 0,
    standard: 8,
    slow: 18,
    rare: 24,
  }[entry.isRare ? 'rare' : entry.experienceKind];
  const evolutionBonus = formCount >= 3 ? index * 18 : index * 20;
  const rareBonus = entry.isRare ? 18 : 0;
  return Math.max(48, Math.round(58 + entry.attack * 1.25 + experienceBonus + evolutionBonus + rareBonus));
}

/** 文字列から安定した番号を作り、同じタイプなら同じ既定見た目を選べるようにします。 */
function getStableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

/** 画像が読めなかった時の予備描画に使う形を、タイプ名から自動で決めます。 */
function getFallbackShape(entry: MonsterCsvEntry): MonsterShape {
  return FALLBACK_SHAPES[getStableHash(entry.attribute) % FALLBACK_SHAPES.length];
}

/** カードや予備描画に使う色を、タイプ名とレア設定から自動で決めます。 */
function getMonsterPalette(entry: MonsterCsvEntry): MonsterPalette {
  return ATTRIBUTE_PALETTES_BY_NAME[entry.attribute] ?? FALLBACK_PALETTE;
}

/** 同じ進化系の行から、前後の進化IDをつないだモンスター定義を作ります。 */
function buildMonsterDefinition(entry: MonsterCsvEntry, familyEntries: MonsterCsvEntry[], index: number): MonsterDefinition {
  const formCount = familyEntries.length as 1 | 2 | 3 | 4;
  return {
    id: entry.id,
    name: entry.name,
    elementName: entry.attribute,
    attribute: entry.attribute,
    dexDescription: entry.dexDescription,
    experienceTable: EXP_TABLES[entry.isRare ? 'rare' : entry.experienceKind],
    evolutionRequiredFragments: getEvolutionRequirement(formCount, index, entry.evolutionRequiredFragments),
    previousEvolutionId: familyEntries[index - 1]?.id ?? null,
    nextEvolutionId: familyEntries[index + 1]?.id ?? null,
    hp: getBattleHp(entry, formCount, index),
    attack: entry.attack,
    moveNames: entry.moveNames,
    goalGauge: getGoalGauge(entry, formCount, index),
    evolutionFamilyId: entry.familyId,
    evolutionStage: entry.evolutionStage,
    maxEvolutionStage: formCount,
    isRare: entry.isRare,
    dexStoryEnabled: entry.dexStoryEnabled,
    dexStoryRequiredFragments: entry.dexStoryRequiredFragments ?? null,
    shape: getFallbackShape(entry),
    imageFileName: entry.imageFileName,
    palette: getMonsterPalette(entry),
  };
}

/** モンスターCSVを読み、ゲーム内で使うモンスター定義一覧へ変換します。 */
export function loadMonsterCsvData(csvText: string): MonsterDefinition[] {
  const entries = parseCsv(csvText).map(parseMonsterCsvEntry);
  const familyEntriesById = new Map<string, MonsterCsvEntry[]>();
  const familyOrder: string[] = [];
  const monsterIds = new Set<string>();

  entries.forEach((entry) => {
    if (monsterIds.has(entry.id)) {
      throw new Error(`Duplicate monster id: ${entry.id}`);
    }
    monsterIds.add(entry.id);

    if (!familyEntriesById.has(entry.familyId)) {
      familyEntriesById.set(entry.familyId, []);
      familyOrder.push(entry.familyId);
    }
    familyEntriesById.get(entry.familyId)?.push(entry);
  });

  return familyOrder.flatMap((familyId) => {
    const familyEntries = validateFamilyEntries(familyId, familyEntriesById.get(familyId) ?? []);
    return familyEntries.map((entry, index) => buildMonsterDefinition(entry, familyEntries, index));
  });
}
