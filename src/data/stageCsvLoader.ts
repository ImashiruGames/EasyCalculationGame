import type {
  ConfigurableProblemRule,
  ProblemAnswerMode,
  ProblemAnswerSlot,
  ProblemDigitRule,
  ProblemExpressionKind,
  ProblemNumberRange,
  ProblemOperatorInput,
  ProblemRemainderRule,
  ProblemRule,
  ProblemRuleDefinition,
  SquareRootProblemMode,
  StageCategoryDefinition,
  StageDefinition,
  StageMonsterDefinition,
  StageUnlockCondition,
} from '../game/types';
import {
  CsvRow,
  optionalCsvValue,
  parseCsv,
  parseCsvNumber,
  parseOptionalCsvNumber,
  requireCsvValue,
} from './csv';

export interface StageCsvSources {
  stageCategories: string;
  stages: string;
  stageProblemRules: string;
  stageMonsters: string;
  stageUnlockConditions: string;
}

export interface StageCsvData {
  stageCategories: StageCategoryDefinition[];
  stages: StageDefinition[];
}

type ProblemRangeSlot =
  | 'left'
  | 'right'
  | 'result'
  | 'remainder'
  | 'denominator'
  | 'leftDenominator'
  | 'rightDenominator'
  | 'resultDenominator';

interface CsvRowWithNumber {
  row: CsvRow;
  rowNumber: number;
}

const LEGACY_PROBLEM_RULES = new Set<ProblemRule>([
  'plusOne',
  'plusTwo',
  'plusThree',
  'noCarryAdd',
  'makeTen',
  'noBorrowSubtract',
  'multiplication',
  'twoDigitMinusOneDigit',
  'makeTenMissingResult',
]);

const PROBLEM_KINDS = new Set<ProblemExpressionKind>([
  'integer',
  'integerDivision',
  'squareRoot',
  'clockTime',
  'clockMinuteConversion',
  'decimal',
  'shapeArea',
  'verticalArithmetic',
  'missingDigitArithmetic',
  'equivalentFraction',
  'sameDenominatorFraction',
  'differentDenominatorFraction',
  'fractionProductQuotient',
]);

const PROBLEM_OPERATORS = new Set<ProblemOperatorInput>([
  '+',
  '-',
  '\u00d7',
  '\u00f7',
  '=',
  'plus',
  'minus',
  'times',
  'multiply',
  '*',
  'divide',
  '/',
  'equal',
]);

const PROBLEM_ANSWER_MODES = new Set<ProblemAnswerMode>([
  'single',
  'quotientRemainder',
  'clockHourMinute',
  'squareRootPair',
  'squareRootSimplify',
  'squareRootExpression',
  'squareRootFraction',
  'squareRootRationalize',
  'choiceGrid',
  'choiceRow',
  'choiceColumn',
  'multiSelect',
]);

const BLANK_SLOTS = new Set<ProblemRangeSlot>([
  'left',
  'right',
  'result',
  'leftDenominator',
  'rightDenominator',
  'resultDenominator',
]);

/** CSVのデータ行に、エラー表示用の元行番号を付けます。 */
function withRowNumbers(rows: CsvRow[]): CsvRowWithNumber[] {
  return rows.map((row, index) => ({ row, rowNumber: index + 2 }));
}

/** `order`列を使って、CSVで指定された表示順に並べ替えます。 */
function sortByOrder(rows: CsvRowWithNumber[]): CsvRowWithNumber[] {
  return [...rows].sort((left, right) => (
    parseCsvNumber(left.row, 'order', left.rowNumber) - parseCsvNumber(right.row, 'order', right.rowNumber)
  ));
}

/** 任意の正の数値列を読み、不正な値ならCSV不備として止めます。 */
function parseOptionalPositiveNumber(row: CsvRow, column: string, rowNumber: number): number | undefined {
  const value = parseOptionalCsvNumber(row, column, rowNumber);
  if (value === undefined) {
    return undefined;
  }
  if (value <= 0) {
    throw new Error(`CSV row ${rowNumber} column "${column}" must be greater than 0.`);
  }

  return value;
}

/** stageId列ごとに行をまとめ、各ステージ内ではorder順にします。 */
function groupByStageId(rows: CsvRowWithNumber[]): Map<string, CsvRowWithNumber[]> {
  const grouped = new Map<string, CsvRowWithNumber[]>();
  rows.forEach((entry) => {
    const stageId = requireCsvValue(entry.row, 'stageId', entry.rowNumber);
    const stageRows = grouped.get(stageId) ?? [];
    stageRows.push(entry);
    grouped.set(stageId, stageRows);
  });

  grouped.forEach((stageRows, stageId) => {
    grouped.set(stageId, sortByOrder(stageRows));
  });

  return grouped;
}

/** CSVの真偽値セルを読み、空なら未指定として扱います。 */
function parseCsvBoolean(row: CsvRow, column: string, rowNumber: number): boolean | undefined {
  const value = optionalCsvValue(row[column]);
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  throw new Error(`CSV row ${rowNumber} column "${column}" must be true or false.`);
}

/** 範囲指定用の数値セルを読み、空なら未指定として扱います。 */
function parseCsvRangeNumber(row: CsvRow, column: string, rowNumber: number): number | undefined {
  const value = optionalCsvValue(row[column]);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`CSV row ${rowNumber} column "${column}" must be a number.`);
  }

  return parsed;
}

/** どの場所を空欄にするかをCSVから読み、使えない指定ならエラーにします。 */
function getBlankSlot(row: CsvRow, rowNumber: number): ProblemRangeSlot | undefined {
  const value = optionalCsvValue(row.blankSlot);
  if (value === undefined) {
    return undefined;
  }

  if (!BLANK_SLOTS.has(value as ProblemRangeSlot)) {
    throw new Error(`CSV row ${rowNumber} column "blankSlot" has an unknown slot.`);
  }

  return value as ProblemRangeSlot;
}

/** `leftMin/leftMax`のような範囲列を、問題生成で使う範囲指定へ変換します。 */
function parseNumberRange(
  row: CsvRow,
  prefix: ProblemRangeSlot,
  blankSlot: ProblemRangeSlot | undefined,
  rowNumber: number,
): ProblemNumberRange {
  const min = parseCsvRangeNumber(row, `${prefix}Min`, rowNumber);
  const max = parseCsvRangeNumber(row, `${prefix}Max`, rowNumber);
  if (min === undefined && max === undefined) {
    return blankSlot === prefix ? [] : null;
  }

  if (min === undefined || max === undefined) {
    throw new Error(`CSV row ${rowNumber} columns "${prefix}Min/${prefix}Max" must both be filled or both be empty.`);
  }

  return [min, max];
}

/** 未指定をundefinedにしたい範囲列を、問題ルール用の任意値として読みます。 */
function parseOptionalNumberRange(
  row: CsvRow,
  prefix: ProblemRangeSlot,
  blankSlot: ProblemRangeSlot | undefined,
  rowNumber: number,
): ProblemNumberRange | undefined {
  const range = parseNumberRange(row, prefix, blankSlot, rowNumber);
  return range === null ? undefined : range;
}

/** 問題の種類をCSVから読み、標準の整数問題なら省略扱いにします。 */
function parseProblemKind(row: CsvRow, rowNumber: number): ProblemExpressionKind | undefined {
  const value = optionalCsvValue(row.kind) ?? 'integer';
  if (!PROBLEM_KINDS.has(value as ProblemExpressionKind)) {
    throw new Error(`CSV row ${rowNumber} column "kind" has an unknown problem kind.`);
  }

  return value === 'integer' ? undefined : value as ProblemExpressionKind;
}

/** 演算子の指定を読み、対応していない記号や別名をエラーにします。 */
function parseProblemOperator(row: CsvRow, rowNumber: number): ProblemOperatorInput {
  const value = requireCsvValue(row, 'operator', rowNumber);
  if (!PROBLEM_OPERATORS.has(value as ProblemOperatorInput)) {
    throw new Error(`CSV row ${rowNumber} column "operator" has an unknown operator.`);
  }

  return value as ProblemOperatorInput;
}

/** くり上がり・くり下がりなどの桁ルールを読みます。 */
function parseProblemDigitRule(row: CsvRow, rowNumber: number): ProblemDigitRule | undefined {
  const value = optionalCsvValue(row.digitRule);
  if (value === undefined) {
    return undefined;
  }

  if (value !== 'noCarry' && value !== 'carryRequired' && value !== 'noBorrow' && value !== 'borrowRequired') {
    throw new Error(`CSV row ${rowNumber} column "digitRule" has an unknown digit rule.`);
  }

  return value;
}

/** 一枠回答か二枠回答かなど、答え方の指定を読みます。 */
function parseProblemAnswerMode(row: CsvRow, rowNumber: number): ProblemAnswerMode | undefined {
  const value = optionalCsvValue(row.answerMode);
  if (value === undefined) {
    return undefined;
  }

  if (!PROBLEM_ANSWER_MODES.has(value as ProblemAnswerMode)) {
    throw new Error(`CSV row ${rowNumber} column "answerMode" has an unknown answer mode.`);
  }

  return value as ProblemAnswerMode;
}

/** わり算のあまりを許すか、必須にするか、なしにするかを読みます。 */
function parseRemainderRule(row: CsvRow, rowNumber: number): ProblemRemainderRule | undefined {
  const value = optionalCsvValue(row.remainderRule);
  if (value === undefined) {
    return undefined;
  }

  if (value !== 'any' && value !== 'none' && value !== 'required') {
    throw new Error(`CSV row ${rowNumber} column "remainderRule" has an unknown remainder rule.`);
  }

  return value;
}

/** √問題の出し方を読み、未対応のモードならCSVエラーにします。 */
function parseRootMode(row: CsvRow, rowNumber: number): SquareRootProblemMode | undefined {
  const value = optionalCsvValue(row.rootMode);
  if (value === undefined) {
    return undefined;
  }

  if (
    value !== 'principal'
    && value !== 'pair'
    && value !== 'simplify'
    && value !== 'absoluteSquare'
    && value !== 'fraction'
    && value !== 'rationalize'
    && value !== 'decimalValue'
    && value !== 'compare'
    && value !== 'addLike'
    && value !== 'minusLike'
    && value !== 'addSimplifyLike'
    && value !== 'minusSimplifyLike'
  ) {
    throw new Error(`CSV row ${rowNumber} column "rootMode" has an unknown root mode.`);
  }

  return value;
}

/** 時計問題の分の刻みを読み、1分から60分の範囲に丸めて確認します。 */
function parseMinuteStep(row: CsvRow, rowNumber: number): number | undefined {
  const value = parseOptionalCsvNumber(row, 'minuteStep', rowNumber);
  if (value === undefined) {
    return undefined;
  }

  const step = Math.floor(value);
  if (step < 1 || step > 60) {
    throw new Error(`CSV row ${rowNumber} column "minuteStep" must be between 1 and 60.`);
  }

  return step;
}

/** 小数けた数を読み、0から3けたまでの整数だけを許可します。 */
function parseDecimalPlaces(row: CsvRow, column: string, rowNumber: number): number | undefined {
  const value = parseOptionalCsvNumber(row, column, rowNumber);
  if (value === undefined) {
    return undefined;
  }

  const places = Math.floor(value);
  if (places !== value || places < 0 || places > 3) {
    throw new Error(`CSV row ${rowNumber} column "${column}" must be an integer between 0 and 3.`);
  }

  return places;
}

/** ステージやカテゴリを表示する学年の下限・上限を読みます。 */
function parsePracticeLevelBoundary(row: CsvRow, column: string, rowNumber: number): number | undefined {
  const value = parseOptionalCsvNumber(row, column, rowNumber);
  if (value === undefined) {
    return undefined;
  }

  const level = Math.floor(value);
  if (level !== value || level < 1 || level > 12) {
    throw new Error(`CSV row ${rowNumber} column "${column}" must be an integer between 1 and 12.`);
  }

  return level;
}

/** 旧形式の問題ルール指定を読み、空なら新形式ルールとして扱います。 */
function parseLegacyProblemRule(row: CsvRow, rowNumber: number): ProblemRule | undefined {
  const value = optionalCsvValue(row.legacyRule);
  if (value === undefined) {
    return undefined;
  }

  if (!LEGACY_PROBLEM_RULES.has(value as ProblemRule)) {
    throw new Error(`CSV row ${rowNumber} column "legacyRule" has an unknown rule.`);
  }

  return value as ProblemRule;
}

/** 新形式の問題ルール行を、問題生成で使う構造化ルールへ変換します。 */
function parseConfigurableProblemRule(entry: CsvRowWithNumber): ConfigurableProblemRule {
  const { row, rowNumber } = entry;
  const kind = parseProblemKind(row, rowNumber);
  const blankSlot = getBlankSlot(row, rowNumber);
  const answerSlot: ProblemAnswerSlot | undefined = blankSlot as ProblemAnswerSlot | undefined;
  const rule: ConfigurableProblemRule = {
    ...(kind ? { kind } : {}),
    ...(answerSlot ? { answerSlot } : {}),
    operator: parseProblemOperator(row, rowNumber),
    left: parseNumberRange(row, 'left', blankSlot, rowNumber),
    right: parseNumberRange(row, 'right', blankSlot, rowNumber),
    result: parseNumberRange(row, 'result', blankSlot, rowNumber),
  };
  const denominator = parseOptionalNumberRange(row, 'denominator', undefined, rowNumber);
  const leftDenominator = parseOptionalNumberRange(row, 'leftDenominator', undefined, rowNumber);
  const rightDenominator = parseOptionalNumberRange(row, 'rightDenominator', undefined, rowNumber);
  const resultDenominator = parseOptionalNumberRange(row, 'resultDenominator', undefined, rowNumber);
  const remainder = parseOptionalNumberRange(row, 'remainder', undefined, rowNumber);
  const digitRule = parseProblemDigitRule(row, rowNumber);
  const answerMode = parseProblemAnswerMode(row, rowNumber);
  const remainderRule = parseRemainderRule(row, rowNumber);
  const rootMode = parseRootMode(row, rowNumber);
  const minuteStep = parseMinuteStep(row, rowNumber);
  const leftDecimalPlaces = parseDecimalPlaces(row, 'leftDecimalPlaces', rowNumber);
  const rightDecimalPlaces = parseDecimalPlaces(row, 'rightDecimalPlaces', rowNumber);
  const resultDecimalPlaces = parseDecimalPlaces(row, 'resultDecimalPlaces', rowNumber);

  if (denominator !== undefined) {
    rule.denominator = denominator;
  }
  if (leftDenominator !== undefined) {
    rule.leftDenominator = leftDenominator;
  }
  if (rightDenominator !== undefined) {
    rule.rightDenominator = rightDenominator;
  }
  if (resultDenominator !== undefined) {
    rule.resultDenominator = resultDenominator;
  }
  if (remainder !== undefined) {
    rule.remainder = remainder;
  }
  if (digitRule !== undefined) {
    rule.digitRule = digitRule;
  }
  if (answerMode !== undefined) {
    rule.answerMode = answerMode;
  }
  if (remainderRule !== undefined) {
    rule.remainderRule = remainderRule;
  }
  if (rootMode !== undefined) {
    rule.rootMode = rootMode;
  }
  if (minuteStep !== undefined) {
    rule.minuteStep = minuteStep;
  }
  if (leftDecimalPlaces !== undefined) {
    rule.leftDecimalPlaces = leftDecimalPlaces;
  }
  if (rightDecimalPlaces !== undefined) {
    rule.rightDecimalPlaces = rightDecimalPlaces;
  }
  if (resultDecimalPlaces !== undefined) {
    rule.resultDecimalPlaces = resultDecimalPlaces;
  }

  return rule;
}

/** ステージごとの問題ルール行を読み、旧形式と新形式の混在を防ぎます。 */
function parseProblemRule(stageId: string, rows: CsvRowWithNumber[]): ProblemRuleDefinition {
  if (rows.length === 0) {
    throw new Error(`Stage "${stageId}" has no problem rules.`);
  }

  const legacyRule = parseLegacyProblemRule(rows[0].row, rows[0].rowNumber);
  if (legacyRule !== undefined) {
    if (rows.length > 1) {
      throw new Error(`Stage "${stageId}" cannot mix legacy problem rules with multiple rows.`);
    }

    return legacyRule;
  }

  return rows.map(parseConfigurableProblemRule);
}

/** ステージ出現モンスター行を、IDだけまたは重みつき定義へ変換します。 */
function parseStageMonster(entry: CsvRowWithNumber): StageMonsterDefinition {
  const monsterId = requireCsvValue(entry.row, 'monsterId', entry.rowNumber);
  const weight = parseOptionalCsvNumber(entry.row, 'weight', entry.rowNumber);
  return weight === undefined ? monsterId : { monsterId, weight };
}

/** ステージに出るモンスター一覧を読み、空なら設定不備として止めます。 */
function parseStageMonsters(stageId: string, rows: CsvRowWithNumber[]): StageMonsterDefinition[] {
  if (rows.length === 0) {
    throw new Error(`Stage "${stageId}" has no monsters.`);
  }

  return rows.map(parseStageMonster);
}

/** 解放条件に説明ラベルがある場合だけ、条件オブジェクトへ追加します。 */
function withOptionalLabel<T extends StageUnlockCondition>(condition: T, label: string | undefined): T {
  return label === undefined ? condition : { ...condition, label };
}

/** ステージ解放条件の行を、条件タイプごとの構造へ変換します。 */
function parseUnlockCondition(entry: CsvRowWithNumber): StageUnlockCondition {
  const { row, rowNumber } = entry;
  const type = requireCsvValue(row, 'type', rowNumber);
  const label = optionalCsvValue(row.label);

  if (type === 'stageClearCount') {
    return withOptionalLabel({
      type,
      stageId: requireCsvValue(row, 'targetStageId', rowNumber),
      count: parseCsvNumber(row, 'count', rowNumber),
    }, label);
  }

  if (type === 'uniqueDexCount') {
    return withOptionalLabel({
      type,
      count: parseCsvNumber(row, 'count', rowNumber),
    }, label);
  }

  if (type === 'monsterCaptured') {
    return withOptionalLabel({
      type,
      monsterId: requireCsvValue(row, 'monsterId', rowNumber),
    }, label);
  }

  if (type === 'achievementUnlocked') {
    return withOptionalLabel({
      type,
      achievementId: requireCsvValue(row, 'achievementId', rowNumber),
    }, label);
  }

  if (type === 'itemOwned') {
    return withOptionalLabel({
      type,
      itemId: requireCsvValue(row, 'itemId', rowNumber),
      count: parseOptionalCsvNumber(row, 'count', rowNumber),
    }, label);
  }

  if (type === 'trainerDefeated') {
    return withOptionalLabel({
      type,
      trainerId: requireCsvValue(row, 'trainerId', rowNumber),
      count: parseOptionalCsvNumber(row, 'count', rowNumber),
    }, label);
  }

  throw new Error(`CSV row ${rowNumber} column "type" has an unknown unlock condition.`);
}

/** ステージカテゴリ行を、カテゴリ定義へ変換します。 */
function parseStageCategory(entry: CsvRowWithNumber): StageCategoryDefinition {
  const { row, rowNumber } = entry;
  const minPracticeLevel = parsePracticeLevelBoundary(row, 'minPracticeLevel', rowNumber);
  const maxPracticeLevel = parsePracticeLevelBoundary(row, 'maxPracticeLevel', rowNumber);
  return {
    id: requireCsvValue(row, 'id', rowNumber),
    name: requireCsvValue(row, 'name', rowNumber),
    subtitle: requireCsvValue(row, 'subtitle', rowNumber),
    accentColor: requireCsvValue(row, 'accentColor', rowNumber),
    ...(minPracticeLevel !== undefined ? { minPracticeLevel } : {}),
    ...(maxPracticeLevel !== undefined ? { maxPracticeLevel } : {}),
  };
}

/** ステージ本体の行に、問題ルール・出現モンスター・解放条件を結びつけます。 */
function parseStage(
  entry: CsvRowWithNumber,
  categoryIds: ReadonlySet<string>,
  problemRulesByStageId: ReadonlyMap<string, CsvRowWithNumber[]>,
  monstersByStageId: ReadonlyMap<string, CsvRowWithNumber[]>,
  unlockConditionsByStageId: ReadonlyMap<string, CsvRowWithNumber[]>,
): StageDefinition {
  const { row, rowNumber } = entry;
  const id = requireCsvValue(row, 'id', rowNumber);
  const stageCategoryId = requireCsvValue(row, 'stageCategoryId', rowNumber);
  if (!categoryIds.has(stageCategoryId)) {
    throw new Error(`CSV row ${rowNumber} references unknown stage category "${stageCategoryId}".`);
  }

  const unlockConditions = (unlockConditionsByStageId.get(id) ?? []).map(parseUnlockCondition);
  const comingSoon = parseCsvBoolean(row, 'comingSoon', rowNumber);
  const playLimitDisabled = parseCsvBoolean(row, 'playLimitDisabled', rowNumber);
  const captureGaugeGain = parseOptionalPositiveNumber(row, 'captureGaugeGain', rowNumber);
  const speedStarAverageMs = parseOptionalPositiveNumber(row, 'speedStarAverageMs', rowNumber);
  const minPracticeLevel = parsePracticeLevelBoundary(row, 'minPracticeLevel', rowNumber);
  const maxPracticeLevel = parsePracticeLevelBoundary(row, 'maxPracticeLevel', rowNumber);
  return {
    id,
    order: parseCsvNumber(row, 'order', rowNumber),
    stageCategoryId,
    name: requireCsvValue(row, 'name', rowNumber),
    subtitle: requireCsvValue(row, 'subtitle', rowNumber),
    themeLabel: requireCsvValue(row, 'themeLabel', rowNumber),
    problemRule: parseProblemRule(id, problemRulesByStageId.get(id) ?? []),
    monsterIds: parseStageMonsters(id, monstersByStageId.get(id) ?? []),
    backgroundPath: optionalCsvValue(row.backgroundPath),
    accentColor: requireCsvValue(row, 'accentColor', rowNumber),
    ...(captureGaugeGain !== undefined ? { captureGaugeGain } : {}),
    ...(speedStarAverageMs !== undefined ? { speedStarAverageMs } : {}),
    ...(minPracticeLevel !== undefined ? { minPracticeLevel } : {}),
    ...(maxPracticeLevel !== undefined ? { maxPracticeLevel } : {}),
    ...(unlockConditions.length > 0 ? { unlockConditions } : {}),
    ...(comingSoon !== undefined ? { comingSoon } : {}),
    ...(playLimitDisabled !== undefined ? { playLimitDisabled } : {}),
  };
}

/** 複数CSVをまとめて読み込み、ゲーム内で使うステージカテゴリとステージ定義を作ります。 */
export function loadStageCsvData(sources: StageCsvSources): StageCsvData {
  const stageCategories = sortByOrder(withRowNumbers(parseCsv(sources.stageCategories))).map(parseStageCategory);
  const categoryIds = new Set(stageCategories.map((category) => category.id));
  const problemRulesByStageId = groupByStageId(withRowNumbers(parseCsv(sources.stageProblemRules)));
  const monstersByStageId = groupByStageId(withRowNumbers(parseCsv(sources.stageMonsters)));
  const unlockConditionsByStageId = groupByStageId(withRowNumbers(parseCsv(sources.stageUnlockConditions)));
  const stages = sortByOrder(withRowNumbers(parseCsv(sources.stages))).map((entry) => (
    parseStage(entry, categoryIds, problemRulesByStageId, monstersByStageId, unlockConditionsByStageId)
  ));

  return { stageCategories, stages };
}
