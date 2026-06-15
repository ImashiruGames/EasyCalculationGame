import {
  ConfigurableProblemRule,
  MathProblem,
  ProblemAnswerMode,
  ProblemDigitRule,
  ProblemHiddenDigitSlot,
  ProblemAnswerSlot,
  ProblemNumberRange,
  ProblemOperator,
  ProblemOperatorInput,
  ProblemRemainderRule,
  ProblemRule,
  ProblemRuleDefinition,
  SquareRootComparisonTerm,
  SquareRootProblemMode,
} from '../types';

interface NumberRange {
  min: number;
  max: number;
}

export type ProblemAnswerPairJudgement = 'correct' | 'partial' | 'wrong';

type SquareRootExpressionMode =
  | 'addLike'
  | 'minusLike'
  | 'addSimplifyLike'
  | 'minusSimplifyLike';
type ChoiceAnswerMode = Extract<ProblemAnswerMode, 'choiceGrid' | 'choiceRow' | 'choiceColumn' | 'multiSelect'>;

interface SquareRootTerm {
  displayCoefficient: number;
  displayRadicand: number;
  coefficient: number;
  radicand: number;
  isSimplified: boolean;
}

const ANSWER_MIN = 0;
const ANSWER_MAX = 2359;
const DEFAULT_OPERAND_RANGE: NumberRange = { min: 0, max: 99 };
const DEFAULT_FRACTION_DENOMINATOR_RANGE: NumberRange = { min: 2, max: 9 };
const DEFAULT_CLOCK_HOUR_RANGE: NumberRange = { min: 1, max: 12 };
const DEFAULT_CLOCK_MINUTE_RANGE: NumberRange = { min: 0, max: 59 };
const DEFAULT_DECIMAL_PLACES = 1;
const DEFAULT_SQUARE_ROOT_DECIMAL_PLACES = 3;
const MISSING_DIGIT_SLOTS: ProblemHiddenDigitSlot[] = [
  'leftTens',
  'leftOnes',
  'rightTens',
  'rightOnes',
  'resultTens',
  'resultOnes',
];
const SQUARE_ROOT_DECIMAL_RADICANDS = [2, 3, 5, 7];
const SQUARE_ROOT_COMPARISON_SETS: SquareRootComparisonTerm[][] = [
  [
    { kind: 'root', sign: 1, value: 2 },
    { kind: 'root', sign: 1, value: 5 },
  ],
  [
    { kind: 'root', sign: 1, value: 1.4 },
    { kind: 'root', sign: 1, value: 1.3 },
  ],
  [
    { kind: 'root', sign: -1, value: 3 },
    { kind: 'root', sign: 1, value: 6 },
  ],
  [
    { kind: 'root', sign: -1, value: 2 },
    { kind: 'root', sign: -1, value: 7 },
  ],
  [
    { kind: 'number', sign: 1, value: 4 },
    { kind: 'root', sign: 1, value: 17 },
  ],
  [
    { kind: 'number', sign: -1, value: 6 },
    { kind: 'root', sign: -1, value: 35 },
  ],
  [
    { kind: 'root', sign: 1, value: 5 },
    { kind: 'number', sign: 1, value: 2 },
    { kind: 'root', sign: 1, value: 6 },
  ],
  [
    { kind: 'root', sign: -1, value: 10 },
    { kind: 'number', sign: -1, value: 3 },
    { kind: 'root', sign: -1, value: 11 },
  ],
];

/** 選択式として扱うanswerModeだけを取り出し、それ以外なら未指定として返します。 */
function getChoiceAnswerMode(rule: ConfigurableProblemRule): ChoiceAnswerMode | undefined {
  if (
    rule.answerMode === 'choiceGrid'
    || rule.answerMode === 'choiceRow'
    || rule.answerMode === 'choiceColumn'
    || rule.answerMode === 'multiSelect'
  ) {
    return rule.answerMode;
  }

  return undefined;
}

const LEGACY_PROBLEM_RULES: Record<ProblemRule, ConfigurableProblemRule[]> = {
  plusOne: [
    { operator: 'plus', left: [1, 1], right: [0, 9], result: [0, 99] },
    { operator: 'plus', left: [0, 9], right: [1, 1], result: [0, 99] },
  ],
  plusTwo: [
    { operator: 'plus', left: [2, 2], right: [0, 9], result: [0, 99] },
    { operator: 'plus', left: [0, 9], right: [2, 2], result: [0, 99] },
  ],
  plusThree: [
    { operator: 'plus', left: [3, 3], right: [0, 9], result: [0, 99] },
    { operator: 'plus', left: [0, 9], right: [3, 3], result: [0, 99] },
  ],
  noCarryAdd: [
    { operator: 'plus', left: [4, 9], right: [0, 9], result: [0, 9] },
  ],
  makeTen: [
    { operator: 'plus', left: [], right: [1, 9], result: [10, 10] },
    { operator: 'plus', left: [1, 9], right: [], result: [10, 10] },
  ],
  noBorrowSubtract: [
    { operator: 'minus', left: [0, 9], right: [0, 9], result: [0, 9] },
  ],
  multiplication: [
    { operator: 'times', left: [2, 5], right: [1, 5], result: [0, 99] },
  ],
  twoDigitMinusOneDigit: [
    { operator: 'minus', left: [10, 19], right: [1, 9], result: [0, 99] },
  ],
  makeTenMissingResult: [
    { operator: 'plus', left: [1, 9], right: [1, 9], result: [10, 10] },
  ],
};

/** 指定範囲の整数をランダムに1つ返します。 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 分数の約分などで使う最大公約数を求めます。 */
function getGreatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a || 1;
}

/** 異分母分数の通分で使う最小公倍数を求めます。 */
function getLeastCommonMultiple(left: number, right: number): number {
  return Math.abs(left * right) / getGreatestCommonDivisor(left, right);
}

/** 候補配列からランダムに1つ選び、候補がなければnullを返します。 */
function pickRandom<T>(values: T[]): T | null {
  if (values.length === 0) {
    return null;
  }

  return values[Math.floor(Math.random() * values.length)];
}

/** CSVで使える演算子の別名を、画面と計算で使う記号へそろえます。 */
function normalizeOperator(operator: ProblemOperatorInput): ProblemOperator {
  if (operator === 'plus') {
    return '+';
  }

  if (operator === 'minus') {
    return '-';
  }

  if (operator === 'times' || operator === 'multiply' || operator === '*') {
    return '×';
  }

  if (operator === 'divide' || operator === '/') {
    return '÷';
  }

  if (operator === 'equal') {
    return '=';
  }

  return operator;
}

/** CSVの範囲指定を、min/maxが昇順の扱いやすい形へ整えます。 */
function normalizeRange(range: ProblemNumberRange): NumberRange | null {
  if (!range || range.length === 0) {
    return null;
  }

  const first = Math.floor(range[0]);
  const second = Math.floor(range[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }

  return {
    min: Math.min(first, second),
    max: Math.max(first, second),
  };
}

/** 範囲指定がない場合は通し、ある場合は値が範囲内かを判定します。 */
function containsRange(range: NumberRange | null, value: number): boolean {
  return !range || (value >= range.min && value <= range.max);
}

/** 小数を整数単位で扱うため、けた数に応じた倍率を返します。 */
function getDecimalScale(decimalPlaces: number): number {
  return 10 ** decimalPlaces;
}

/** 小数けた数を0から3の範囲に丸め、未指定なら既定値にします。 */
function normalizeDecimalPlaces(decimalPlaces: number | undefined): number {
  if (decimalPlaces === undefined || !Number.isFinite(decimalPlaces)) {
    return DEFAULT_DECIMAL_PLACES;
  }

  return Math.max(0, Math.min(3, Math.floor(decimalPlaces)));
}

/** 小数の範囲指定を、指定けた数の整数単位へ変換します。 */
function normalizeDecimalRange(range: ProblemNumberRange, decimalPlaces: number): NumberRange | null {
  if (!range || range.length === 0) {
    return null;
  }

  const scale = getDecimalScale(decimalPlaces);
  const minUnit = Math.ceil(Math.min(range[0], range[1]) * scale - 1e-9);
  const maxUnit = Math.floor(Math.max(range[0], range[1]) * scale + 1e-9);
  if (!Number.isFinite(minUnit) || !Number.isFinite(maxUnit)) {
    return null;
  }

  return { min: minUnit, max: maxUnit };
}

/** 整数単位で持っている小数値を、表示や判定で使う実数へ戻します。 */
function decimalUnitToValue(unit: number, decimalPlaces: number): number {
  return unit / getDecimalScale(decimalPlaces);
}

/** 指定した小数けたで四捨五入した数値を返します。 */
function roundToDecimalPlaces(value: number, decimalPlaces: number): number {
  const scale = getDecimalScale(decimalPlaces);
  return Math.round(value * scale) / scale;
}

/** 小数問題で範囲未指定のときに使う、0から99までの整数単位範囲を返します。 */
function getDefaultDecimalUnitRange(decimalPlaces: number): NumberRange {
  return { min: 0, max: 99 * getDecimalScale(decimalPlaces) };
}

/** 問題内の指定スロットが何けた小数で表示されるかを返します。 */
function getProblemDecimalPlaces(problem: MathProblem, slot: 'left' | 'right' | 'result'): number {
  if (slot === 'left') {
    return normalizeDecimalPlaces(problem.leftDecimalPlaces);
  }
  if (slot === 'right') {
    return normalizeDecimalPlaces(problem.rightDecimalPlaces);
  }

  return normalizeDecimalPlaces(problem.resultDecimalPlaces);
}

/** 答え欄になっている場所の小数けた数を返します。 */
export function getProblemAnswerDecimalPlaces(problem: MathProblem): number {
  if (problem.answerSlot === 'left') {
    return getProblemDecimalPlaces(problem, 'left');
  }
  if (problem.answerSlot === 'right') {
    return getProblemDecimalPlaces(problem, 'right');
  }

  return getProblemDecimalPlaces(problem, 'result');
}

/** ルールから空欄位置を決め、複数空欄のように判定できない場合はnullにします。 */
function getAnswerSlot(rule: ConfigurableProblemRule): ProblemAnswerSlot | null {
  if (rule.answerSlot) {
    return rule.answerSlot;
  }

  const blankSlots = [
    ['left', rule.left],
    ['right', rule.right],
    ['result', rule.result],
    ['leftDenominator', rule.leftDenominator],
    ['rightDenominator', rule.rightDenominator],
    ['resultDenominator', rule.resultDenominator],
  ].filter(([, range]) => Array.isArray(range) && range.length === 0);

  if (blankSlots.length > 1) {
    return null;
  }

  return blankSlots.length === 1
    ? blankSlots[0][0] as ProblemAnswerSlot
    : 'result';
}

/** 演算子と左右の数から計算結果を求めます。割る数が0なら無効値にします。 */
function calculateResult(operator: ProblemOperator, left: number, right: number): number {
  if (operator === '+') {
    return left + right;
  }

  if (operator === '-') {
    return left - right;
  }

  if (operator === '×') {
    return left * right;
  }

  return right === 0 ? Number.NaN : left / right;
}

/** 引き算で何回くり下がりが起きるかを、1の位から順に数えます。 */
function countSubtractBorrows(left: number, right: number): number {
  let remainingLeft = left;
  let remainingRight = right;
  let borrow = 0;
  let borrowCount = 0;

  while (remainingLeft > 0 || remainingRight > 0) {
    const leftDigit = remainingLeft % 10;
    const rightDigit = remainingRight % 10;
    if (leftDigit - borrow < rightDigit) {
      borrowCount += 1;
      borrow = 1;
    } else {
      borrow = 0;
    }

    remainingLeft = Math.floor(remainingLeft / 10);
    remainingRight = Math.floor(remainingRight / 10);
  }

  return borrowCount;
}

/** 足し算で何回くり上がりが起きるかを、1の位から順に数えます。 */
function countAddCarries(left: number, right: number): number {
  let remainingLeft = left;
  let remainingRight = right;
  let carry = 0;
  let carryCount = 0;

  while (remainingLeft > 0 || remainingRight > 0) {
    const leftDigit = remainingLeft % 10;
    const rightDigit = remainingRight % 10;
    const digitSum = leftDigit + rightDigit + carry;
    if (digitSum >= 10) {
      carryCount += 1;
      carry = 1;
    } else {
      carry = 0;
    }

    remainingLeft = Math.floor(remainingLeft / 10);
    remainingRight = Math.floor(remainingRight / 10);
  }

  return carryCount;
}

/** くり上がり・くり下がり条件に、今回の式が合っているかを判定します。 */
function matchesDigitRule(
  digitRule: ProblemDigitRule | undefined,
  operator: ProblemOperator,
  left: number,
  right: number,
): boolean {
  if (!digitRule) {
    return true;
  }

  if (operator === '+') {
    const carryCount = countAddCarries(left, right);
    if (digitRule === 'noCarry') {
      return carryCount === 0;
    }
    if (digitRule === 'carryRequired') {
      return carryCount > 0;
    }
    return true;
  }

  if (operator === '-') {
    const borrowCount = countSubtractBorrows(left, right);
    if (digitRule === 'noBorrow') {
      return borrowCount === 0;
    }
    if (digitRule === 'borrowRequired') {
      return borrowCount > 0;
    }
    return true;
  }

  return true;
}

/** あまりの有無に関するルールに、今回のあまりが合っているかを判定します。 */
function matchesRemainderRule(remainderRule: ProblemRemainderRule | undefined, remainder: number): boolean {
  if (!remainderRule || remainderRule === 'any') {
    return true;
  }

  if (remainderRule === 'none') {
    return remainder === 0;
  }

  return remainder > 0;
}

/** 空欄位置に応じて、その問題の正しい答えになる値を取り出します。 */
function getAnswerValue(problem: Omit<MathProblem, 'answer'>): number {
  if (problem.answerSlot === 'left') {
    return problem.left;
  }

  if (problem.answerSlot === 'right') {
    return problem.right;
  }

  if (problem.answerSlot === 'leftDenominator') {
    return problem.leftDenominator ?? 0;
  }

  if (problem.answerSlot === 'rightDenominator') {
    return problem.rightDenominator ?? 0;
  }

  if (problem.answerSlot === 'resultDenominator') {
    return problem.resultDenominator ?? 0;
  }

  return problem.result;
}

/** テンキーで扱える答えの範囲内かを確認します。 */
function isAnswerInInputRange(answer: number): boolean {
  return answer >= ANSWER_MIN && answer <= ANSWER_MAX;
}

/** 範囲未指定のループには、標準の0から99の範囲を使います。 */
function toLoopRange(range: NumberRange | null): NumberRange {
  return range ?? DEFAULT_OPERAND_RANGE;
}

/** 時計の時刻を、分が0なら時だけ、それ以外は時分の数値へ符号化します。 */
function encodeClockAnswer(hour: number, minute: number): number {
  return minute === 0 ? hour : hour * 100 + minute;
}

/** 時計問題の時刻を、問題文や答え表示で読める文字列にします。 */
function formatClockTime(hour: number, minute: number): string {
  return minute === 0 ? `${hour}時` : `${hour}時${minute}分`;
}

/** 時計を読む問題の候補を、時・分・答え範囲から全件作ります。 */
function collectClockTimeCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || (answerSlot !== 'left' && answerSlot !== 'right' && answerSlot !== 'result')) {
    return [];
  }

  const hourRange = clampRange(normalizeRange(rule.left) ?? DEFAULT_CLOCK_HOUR_RANGE, 1, 12);
  const minuteRange = clampRange(normalizeRange(rule.right) ?? DEFAULT_CLOCK_MINUTE_RANGE, 0, 59);
  const resultRange = normalizeRange(rule.result);
  const minuteStep = Math.max(1, Math.min(60, Math.floor(rule.minuteStep ?? 1)));
  const candidates: MathProblem[] = [];
  if (!hourRange || !minuteRange) {
    return candidates;
  }

  for (let hour = hourRange.min; hour <= hourRange.max; hour += 1) {
    for (let minute = minuteRange.min; minute <= minuteRange.max; minute += 1) {
      if (minute % minuteStep !== 0) {
        continue;
      }

      const result = encodeClockAnswer(hour, minute);
      if (!containsRange(resultRange, result)) {
        continue;
      }

      const problemWithoutAnswer = {
        kind: 'clockTime' as const,
        left: hour,
        operator: '=' as const,
        right: minute,
        result,
        answerSlot,
        minuteStep,
      };
      const answer = getAnswerValue(problemWithoutAnswer);
      if (!isAnswerInInputRange(answer)) {
        continue;
      }

      candidates.push({
        ...problemWithoutAnswer,
        answer,
      });
    }
  }

  return candidates;
}

/** 分を時間と分へ直す問題の候補を、単独答えと二枠答えの両方に対応して作ります。 */
function collectClockMinuteConversionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || answerSlot !== 'result' || (operator !== '=' && operator !== '×')) {
    return [];
  }

  const sourceLeftRange = normalizeRange(rule.left);
  const sourceRightRange = normalizeRange(rule.right);
  const usesLegacyTimesRange = operator === '×'
    && sourceLeftRange !== null
    && sourceRightRange !== null
    && sourceRightRange.min === sourceRightRange.max;
  const totalMinuteRange = usesLegacyTimesRange
    ? {
        min: sourceLeftRange.min * sourceRightRange.min,
        max: sourceLeftRange.max * sourceRightRange.max,
      }
    : sourceLeftRange ?? { min: 60, max: 110 };
  const hourRange = usesLegacyTimesRange ? null : sourceRightRange;
  const resultRange = normalizeRange(rule.result);
  const minuteStep = Math.max(1, Math.min(60, Math.floor(rule.minuteStep ?? 10)));
  const usesPairAnswer = rule.answerMode === 'clockHourMinute';
  const candidates: MathProblem[] = [];

  for (let totalMinutes = totalMinuteRange.min; totalMinutes <= totalMinuteRange.max; totalMinutes += 1) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    if (totalMinutes < 60 || hour < 1 || minute % minuteStep !== 0) {
      continue;
    }
    if (!containsRange(hourRange, hour) || !containsRange(resultRange, minute)) {
      continue;
    }

    const problemWithoutAnswer = {
      kind: 'clockMinuteConversion' as const,
      left: totalMinutes,
      operator: '=' as const,
      right: hour,
      result: minute,
      ...(usesPairAnswer ? { remainder: minute, answerMode: rule.answerMode } : {}),
      answerSlot,
      minuteStep,
    };
    const answer = getAnswerValue(problemWithoutAnswer);
    if (!isAnswerInInputRange(answer)) {
      continue;
    }

    candidates.push({
      ...problemWithoutAnswer,
      answer,
    });
  }

  return candidates;
}

/** 小数の加減問題をルールから1問作り、まずランダムに探してから全探索で補います。 */
function createDecimalProblemFromConfig(rule: ConfigurableProblemRule): MathProblem | null {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || (answerSlot !== 'left' && answerSlot !== 'right' && answerSlot !== 'result')) {
    return null;
  }
  if (operator !== '+' && operator !== '-') {
    return null;
  }

  const leftDecimalPlaces = normalizeDecimalPlaces(rule.leftDecimalPlaces);
  const rightDecimalPlaces = normalizeDecimalPlaces(rule.rightDecimalPlaces);
  const resultDecimalPlaces = normalizeDecimalPlaces(rule.resultDecimalPlaces);
  const leftRange = normalizeDecimalRange(rule.left, leftDecimalPlaces) ?? getDefaultDecimalUnitRange(leftDecimalPlaces);
  const rightRange = normalizeDecimalRange(rule.right, rightDecimalPlaces) ?? getDefaultDecimalUnitRange(rightDecimalPlaces);
  const resultRange = normalizeDecimalRange(rule.result, resultDecimalPlaces);
  const maxDecimalPlaces = Math.max(leftDecimalPlaces, rightDecimalPlaces, resultDecimalPlaces);
  const commonScale = getDecimalScale(maxDecimalPlaces);
  const leftFactor = commonScale / getDecimalScale(leftDecimalPlaces);
  const rightFactor = commonScale / getDecimalScale(rightDecimalPlaces);
  const resultFactor = commonScale / getDecimalScale(resultDecimalPlaces);

  const buildProblem = (leftUnit: number, rightUnit: number): MathProblem | null => {
    const leftCommon = leftUnit * leftFactor;
    const rightCommon = rightUnit * rightFactor;
    const resultCommon = operator === '+'
      ? leftCommon + rightCommon
      : leftCommon - rightCommon;
    if (resultCommon < 0 || resultCommon % resultFactor !== 0) {
      return null;
    }
    if (!matchesDigitRule(rule.digitRule, operator, leftCommon, rightCommon)) {
      return null;
    }

    const resultUnit = resultCommon / resultFactor;
    if (!containsRange(resultRange, resultUnit)) {
      return null;
    }

    const problemWithoutAnswer = {
      kind: 'decimal' as const,
      left: decimalUnitToValue(leftUnit, leftDecimalPlaces),
      operator,
      right: decimalUnitToValue(rightUnit, rightDecimalPlaces),
      result: decimalUnitToValue(resultUnit, resultDecimalPlaces),
      answerSlot,
      leftDecimalPlaces,
      rightDecimalPlaces,
      resultDecimalPlaces,
    };
    const answer = getAnswerValue(problemWithoutAnswer);
    if (!isAnswerInInputRange(answer)) {
      return null;
    }

    return {
      ...problemWithoutAnswer,
      answer,
    };
  };

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const problem = buildProblem(
      randomBetween(leftRange.min, leftRange.max),
      randomBetween(rightRange.min, rightRange.max),
    );
    if (problem) {
      return problem;
    }
  }

  const leftCount = leftRange.max - leftRange.min + 1;
  const rightCount = rightRange.max - rightRange.min + 1;
  if (leftCount * rightCount > 20000) {
    return null;
  }

  for (let leftUnit = leftRange.min; leftUnit <= leftRange.max; leftUnit += 1) {
    for (let rightUnit = rightRange.min; rightUnit <= rightRange.max; rightUnit += 1) {
      const problem = buildProblem(leftUnit, rightUnit);
      if (problem) {
        return problem;
      }
    }
  }

  return null;
}

/** 整数の四則計算候補を、範囲・答え位置・桁ルールに合わせて集めます。 */
function collectIntegerProblemCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot) {
    return [];
  }

  const choiceAnswerMode = getChoiceAnswerMode(rule);
  const leftRange = normalizeRange(rule.left);
  const rightRange = normalizeRange(rule.right);
  const resultRange = normalizeRange(rule.result);
  const leftLoopRange = toLoopRange(leftRange);
  const rightLoopRange = toLoopRange(rightRange);
  const candidates: MathProblem[] = [];

  for (let left = leftLoopRange.min; left <= leftLoopRange.max; left += 1) {
    for (let right = rightLoopRange.min; right <= rightLoopRange.max; right += 1) {
      const result = calculateResult(operator, left, right);
      if (!Number.isInteger(result) || result < 0 || !containsRange(resultRange, result)) {
        continue;
      }
      if (!matchesDigitRule(rule.digitRule, operator, left, right)) {
        continue;
      }

      const problemWithoutAnswer = {
        left,
        operator,
        right,
        result,
        answerSlot,
        ...(choiceAnswerMode ? { answerMode: choiceAnswerMode } : {}),
      };
      const answer = getAnswerValue(problemWithoutAnswer);
      if (!isAnswerInInputRange(answer)) {
        continue;
      }

      candidates.push({
        ...problemWithoutAnswer,
        answer,
      });
    }
  }

  return candidates;
}

/** Builds rectangle area problems from height and width ranges. */
function collectShapeAreaCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || (answerSlot !== 'left' && answerSlot !== 'right' && answerSlot !== 'result') || operator !== '×') {
    return [];
  }

  const leftRange = clampRange(normalizeRange(rule.left) ?? { min: 1, max: 12 }, 1, 99);
  const rightRange = clampRange(normalizeRange(rule.right) ?? { min: 1, max: 12 }, 1, 99);
  const resultRange = normalizeRange(rule.result);
  const candidates: MathProblem[] = [];
  if (!leftRange || !rightRange) {
    return candidates;
  }

  for (let left = leftRange.min; left <= leftRange.max; left += 1) {
    for (let right = rightRange.min; right <= rightRange.max; right += 1) {
      const result = left * right;
      if (!containsRange(resultRange, result)) {
        continue;
      }

      const problemWithoutAnswer = {
        kind: 'shapeArea' as const,
        left,
        operator,
        right,
        result,
        answerSlot,
      };
      const answer = getAnswerValue(problemWithoutAnswer);
      if (!isAnswerInInputRange(answer)) {
        continue;
      }

      candidates.push({
        ...problemWithoutAnswer,
        answer,
      });
    }
  }

  return candidates;
}

/** Builds arithmetic problems that are displayed as vertical calculations. */
function collectVerticalArithmeticCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  if (operator !== '+' && operator !== '-' && operator !== '×') {
    return [];
  }

  const integerRule: ConfigurableProblemRule = {
    operator: rule.operator,
    answerSlot: rule.answerSlot,
    left: rule.left,
    right: rule.right,
    result: rule.result,
    digitRule: rule.digitRule,
  };

  return collectIntegerProblemCandidates(integerRule).map((problem) => ({
    ...problem,
    kind: 'verticalArithmetic' as const,
  }));
}

/** Returns the two-digit value that owns the hidden digit slot. */
function getMissingDigitSourceValue(problem: MathProblem, slot: ProblemHiddenDigitSlot): number {
  if (slot === 'leftTens' || slot === 'leftOnes') {
    return problem.left;
  }
  if (slot === 'rightTens' || slot === 'rightOnes') {
    return problem.right;
  }

  return problem.result;
}

/** Returns the hidden digit answer when the target value is a two-digit number. */
function getMissingDigitAnswer(problem: MathProblem, slot: ProblemHiddenDigitSlot): number | null {
  const value = getMissingDigitSourceValue(problem, slot);
  if (value < 10 || value > 99) {
    return null;
  }

  return slot.endsWith('Tens') ? Math.floor(value / 10) : value % 10;
}

/** Builds missing-digit arithmetic problems by hiding one digit in a valid integer equation. */
function collectMissingDigitArithmeticCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  if (operator !== '+' && operator !== '-') {
    return [];
  }

  const integerRule: ConfigurableProblemRule = {
    operator: rule.operator,
    answerSlot: 'result',
    left: rule.left,
    right: rule.right,
    result: rule.result,
    digitRule: rule.digitRule,
  };
  const candidates: MathProblem[] = [];

  collectIntegerProblemCandidates(integerRule).forEach((problem) => {
    MISSING_DIGIT_SLOTS.forEach((hiddenDigitSlot) => {
      const answer = getMissingDigitAnswer(problem, hiddenDigitSlot);
      if (answer === null || !isAnswerInInputRange(answer)) {
        return;
      }

      candidates.push({
        ...problem,
        kind: 'missingDigitArithmetic' as const,
        hiddenDigitSlot,
        answerSlot: 'result',
        answer,
      });
    });
  });

  return candidates;
}

/** あまりつき割り算の候補を、商・あまり・答え方の条件に合わせて集めます。 */
function collectIntegerDivisionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || answerSlot !== 'result' || operator !== '÷') {
    return [];
  }

  const leftRange = toLoopRange(normalizeRange(rule.left));
  const rightRange = normalizeRange(rule.right) ?? { min: 1, max: 9 };
  const resultRange = normalizeRange(rule.result);
  const remainderRange = normalizeRange(rule.remainder ?? null);
  const candidates: MathProblem[] = [];

  for (let left = leftRange.min; left <= leftRange.max; left += 1) {
    for (let right = Math.max(1, rightRange.min); right <= rightRange.max; right += 1) {
      if (left < 0 || right <= 0) {
        continue;
      }

      const result = Math.floor(left / right);
      const remainder = left % right;
      if (!containsRange(resultRange, result) || !containsRange(remainderRange, remainder)) {
        continue;
      }
      if (!matchesRemainderRule(rule.remainderRule, remainder)) {
        continue;
      }

      const answerMode = rule.remainderRule === 'required'
        ? 'quotientRemainder' as const
        : rule.answerMode;
      const problemWithoutAnswer = {
        kind: 'integerDivision' as const,
        left,
        operator,
        right,
        result,
        remainder,
        answerSlot,
        ...(answerMode ? { answerMode } : {}),
      };
      const answer = getAnswerValue(problemWithoutAnswer);
      if (!isAnswerInInputRange(answer)) {
        continue;
      }

      candidates.push({
        ...problemWithoutAnswer,
        answer,
      });
    }
  }

  return candidates;
}

/** √の中の数を、外に出せる係数と残る数に分けます。 */
function getSquareRootParts(value: number): { coefficient: number; radicand: number } | null {
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  let coefficient = 1;
  let radicand = value;
  const maxFactor = Math.floor(Math.sqrt(value));
  for (let factor = maxFactor; factor >= 2; factor -= 1) {
    const square = factor * factor;
    if (value % square === 0) {
      coefficient = factor;
      radicand = value / square;
      break;
    }
  }

  return { coefficient, radicand };
}

/** √問題のモードを取得し、未指定なら基本の平方根問題にします。 */
function getSquareRootMode(rule: ConfigurableProblemRule): SquareRootProblemMode {
  return rule.rootMode ?? 'principal';
}

/** √同士の加減式として扱うモードかどうかを判定します。 */
function isSquareRootExpressionMode(rootMode: SquareRootProblemMode): rootMode is SquareRootExpressionMode {
  return rootMode === 'addLike'
    || rootMode === 'minusLike'
    || rootMode === 'addSimplifyLike'
    || rootMode === 'minusSimplifyLike';
}

/** √式の加減モードとCSVの演算子から、実際に使う+/-を決めます。 */
function getSquareRootExpressionOperator(
  rootMode: SquareRootExpressionMode,
  operatorInput: ProblemOperatorInput,
): '+' | '-' {
  const operator = normalizeOperator(operatorInput);
  if (operator === '+' || operator === '-') {
    return operator;
  }

  return rootMode === 'minusLike' || rootMode === 'minusSimplifyLike' ? '-' : '+';
}

/** ループ用の範囲を取得し、未指定なら渡された既定範囲を使います。 */
function getLoopRangeOrFallback(range: ProblemNumberRange | undefined, fallback: NumberRange): NumberRange {
  return normalizeRange(range ?? null) ?? fallback;
}

/** √の中に平方因子が残っていない、整理済みの根号内数かを判定します。 */
function isSquareFreeRootRadicand(value: number): boolean {
  const parts = getSquareRootParts(value);
  return !!parts && parts.coefficient === 1 && parts.radicand === value && value > 1;
}

/** 表示上の係数と根号内数から、整理後の√項情報を作ります。 */
function getSquareRootTerm(displayCoefficient: number, displayRadicand: number): SquareRootTerm | null {
  if (!Number.isInteger(displayCoefficient) || displayCoefficient <= 0) {
    return null;
  }

  const parts = getSquareRootParts(displayRadicand);
  if (!parts || parts.radicand <= 1) {
    return null;
  }

  return {
    displayCoefficient,
    displayRadicand,
    coefficient: displayCoefficient * parts.coefficient,
    radicand: parts.radicand,
    isSimplified: parts.coefficient === 1,
  };
}

/** 大小比較用の項を、実際に比べる数値へ変換します。 */
function getSquareRootComparisonTermValue(term: SquareRootComparisonTerm): number {
  const baseValue = term.kind === 'root' ? Math.sqrt(term.value) : term.value;
  return term.sign * baseValue;
}

/** 大小比較用の項から、画面やログで使う表示文字列を作ります。 */
function formatSquareRootComparisonTerm(term: SquareRootComparisonTerm): string {
  const sign = term.sign < 0 ? '-' : '';
  return term.kind === 'root' ? `${sign}√${term.value}` : `${sign}${term.value}`;
}

/** 大小比較の項リストから、最も大きい項の1始まり番号を返します。 */
function getLargestSquareRootComparisonTermIndex(terms: SquareRootComparisonTerm[]): number {
  let largestIndex = 0;
  let largestValue = -Infinity;
  terms.forEach((term, index) => {
    const value = getSquareRootComparisonTermValue(term);
    if (value > largestValue) {
      largestValue = value;
      largestIndex = index;
    }
  });

  return largestIndex + 1;
}

/** √項どうしの加減問題を1問にまとめ、答え範囲外なら破棄します。 */
function createSquareRootExpressionProblem(
  rootMode: SquareRootExpressionMode,
  operator: '+' | '-',
  leftTerm: SquareRootTerm,
  rightTerm: SquareRootTerm,
  result: number,
  answerSlot: ProblemAnswerSlot,
): MathProblem | null {
  const problemWithoutAnswer: Omit<MathProblem, 'answer'> = {
    kind: 'squareRoot',
    left: leftTerm.displayCoefficient,
    operator,
    right: rightTerm.displayCoefficient,
    result,
    remainder: leftTerm.radicand,
    answerSlot,
    answerMode: 'squareRootExpression',
    rootMode,
    rootLeftRadicand: leftTerm.displayRadicand,
    rootRightRadicand: rightTerm.displayRadicand,
  };
  const answer = getAnswerValue(problemWithoutAnswer);
  if (!isAnswerInInputRange(answer)) {
    return null;
  }

  return {
    ...problemWithoutAnswer,
    answer,
  };
}

/** 同じ根号内数どうしを足し引きする√式の候補を集めます。 */
function collectSameRadicandSquareRootExpressionCandidates(
  rule: ConfigurableProblemRule,
  rootMode: SquareRootExpressionMode,
  answerSlot: ProblemAnswerSlot,
): MathProblem[] {
  const operator = getSquareRootExpressionOperator(rootMode, rule.operator);
  const leftCoefficientRange = getLoopRangeOrFallback(rule.left, { min: 1, max: 9 });
  const rightCoefficientRange = getLoopRangeOrFallback(rule.right, { min: 1, max: 9 });
  const resultRange = normalizeRange(rule.result);
  const answerRadicandRange = getLoopRangeOrFallback(rule.remainder, { min: 2, max: 12 });
  const leftRadicandRange = normalizeRange(rule.leftDenominator ?? null);
  const rightRadicandRange = normalizeRange(rule.rightDenominator ?? null);
  const candidates: MathProblem[] = [];

  for (let radicand = Math.max(2, answerRadicandRange.min); radicand <= answerRadicandRange.max; radicand += 1) {
    if (!isSquareFreeRootRadicand(radicand)
      || !containsRange(leftRadicandRange, radicand)
      || !containsRange(rightRadicandRange, radicand)
    ) {
      continue;
    }

    for (let left = Math.max(1, leftCoefficientRange.min); left <= leftCoefficientRange.max; left += 1) {
      const leftTerm = getSquareRootTerm(left, radicand);
      if (!leftTerm) {
        continue;
      }

      for (let right = Math.max(1, rightCoefficientRange.min); right <= rightCoefficientRange.max; right += 1) {
        const rightTerm = getSquareRootTerm(right, radicand);
        if (!rightTerm) {
          continue;
        }

        const result = operator === '+'
          ? leftTerm.coefficient + rightTerm.coefficient
          : leftTerm.coefficient - rightTerm.coefficient;
        if (result <= 0 || !containsRange(resultRange, result)) {
          continue;
        }

        const problem = createSquareRootExpressionProblem(rootMode, operator, leftTerm, rightTerm, result, answerSlot);
        if (problem) {
          candidates.push(problem);
        }
      }
    }
  }

  return candidates;
}

/** 整理が必要な√項を含む加減式の候補を集めます。 */
function collectSimplifyingSquareRootExpressionCandidates(
  rule: ConfigurableProblemRule,
  rootMode: SquareRootExpressionMode,
  answerSlot: ProblemAnswerSlot,
): MathProblem[] {
  const operator = getSquareRootExpressionOperator(rootMode, rule.operator);
  const leftCoefficientRange = getLoopRangeOrFallback(rule.left, { min: 1, max: 5 });
  const rightCoefficientRange = getLoopRangeOrFallback(rule.right, { min: 1, max: 5 });
  const resultRange = normalizeRange(rule.result);
  const answerRadicandRange = normalizeRange(rule.remainder ?? null);
  const leftRadicandRange = getLoopRangeOrFallback(rule.leftDenominator, { min: 2, max: 50 });
  const rightRadicandRange = getLoopRangeOrFallback(rule.rightDenominator, { min: 2, max: 50 });
  const candidates: MathProblem[] = [];

  for (let leftCoefficient = Math.max(1, leftCoefficientRange.min); leftCoefficient <= leftCoefficientRange.max; leftCoefficient += 1) {
    for (let leftRadicand = Math.max(2, leftRadicandRange.min); leftRadicand <= leftRadicandRange.max; leftRadicand += 1) {
      const leftTerm = getSquareRootTerm(leftCoefficient, leftRadicand);
      if (!leftTerm) {
        continue;
      }

      for (let rightCoefficient = Math.max(1, rightCoefficientRange.min); rightCoefficient <= rightCoefficientRange.max; rightCoefficient += 1) {
        for (let rightRadicand = Math.max(2, rightRadicandRange.min); rightRadicand <= rightRadicandRange.max; rightRadicand += 1) {
          const rightTerm = getSquareRootTerm(rightCoefficient, rightRadicand);
          if (!rightTerm || leftTerm.radicand !== rightTerm.radicand) {
            continue;
          }
          if (leftTerm.isSimplified && rightTerm.isSimplified) {
            continue;
          }

          const result = operator === '+'
            ? leftTerm.coefficient + rightTerm.coefficient
            : leftTerm.coefficient - rightTerm.coefficient;
          if (
            result <= 0
            || !containsRange(resultRange, result)
            || !containsRange(answerRadicandRange, leftTerm.radicand)
          ) {
            continue;
          }

          const problem = createSquareRootExpressionProblem(rootMode, operator, leftTerm, rightTerm, result, answerSlot);
          if (problem) {
            candidates.push(problem);
          }
        }
      }
    }
  }

  return candidates;
}

/** √式モードに応じて、同じ根号内数型か整理型の候補集めへ振り分けます。 */
function collectSquareRootExpressionCandidates(
  rule: ConfigurableProblemRule,
  rootMode: SquareRootExpressionMode,
): MathProblem[] {
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || answerSlot !== 'result') {
    return [];
  }

  return rootMode === 'addLike' || rootMode === 'minusLike'
    ? collectSameRadicandSquareRootExpressionCandidates(rule, rootMode, answerSlot)
    : collectSimplifyingSquareRootExpressionCandidates(rule, rootMode, answerSlot);
}

/** √(±n)²を外して、絶対値として答える候補を集めます。 */
function collectAbsoluteSquareRootCandidates(rule: ConfigurableProblemRule, answerSlot: ProblemAnswerSlot): MathProblem[] {
  const baseRange = normalizeRange(rule.left) ?? { min: -12, max: 12 };
  const resultRange = normalizeRange(rule.result);
  const candidates: MathProblem[] = [];

  for (let base = baseRange.min; base <= baseRange.max; base += 1) {
    const result = Math.abs(base);
    if (result === 0 || !containsRange(resultRange, result)) {
      continue;
    }

    const problemWithoutAnswer = {
      kind: 'squareRoot' as const,
      left: base,
      operator: '=' as const,
      right: base * base,
      result,
      remainder: 1,
      answerSlot,
      rootMode: 'absoluteSquare' as const,
    };
    candidates.push({
      ...problemWithoutAnswer,
      answer: getAnswerValue(problemWithoutAnswer),
    });
  }

  return candidates;
}

/** √分数を外して、分子と分母で答える候補を集めます。 */
function collectFractionSquareRootCandidates(rule: ConfigurableProblemRule, answerSlot: ProblemAnswerSlot): MathProblem[] {
  const numeratorRootRange = normalizeRange(rule.left) ?? { min: 1, max: 9 };
  const denominatorRootRange = normalizeRange(rule.right) ?? { min: 2, max: 12 };
  const numeratorAnswerRange = normalizeRange(rule.result);
  const denominatorAnswerRange = normalizeRange(rule.remainder ?? null);
  const candidates: MathProblem[] = [];

  for (let numeratorRoot = Math.max(1, numeratorRootRange.min); numeratorRoot <= numeratorRootRange.max; numeratorRoot += 1) {
    for (let denominatorRoot = Math.max(2, denominatorRootRange.min); denominatorRoot <= denominatorRootRange.max; denominatorRoot += 1) {
      if (numeratorRoot >= denominatorRoot) {
        continue;
      }

      const divisor = getGreatestCommonDivisor(numeratorRoot, denominatorRoot);
      const result = numeratorRoot / divisor;
      const remainder = denominatorRoot / divisor;
      if (!containsRange(numeratorAnswerRange, result) || !containsRange(denominatorAnswerRange, remainder)) {
        continue;
      }

      const problemWithoutAnswer = {
        kind: 'squareRoot' as const,
        left: numeratorRoot * numeratorRoot,
        operator: '=' as const,
        right: denominatorRoot * denominatorRoot,
        result,
        remainder,
        answerSlot,
        answerMode: 'squareRootFraction' as const,
        rootMode: 'fraction' as const,
      };
      candidates.push({
        ...problemWithoutAnswer,
        answer: getAnswerValue(problemWithoutAnswer),
      });
    }
  }

  return candidates;
}

/** 分母の√をなくし、分子の√係数と分母で答える候補を集めます。 */
function collectRationalizeSquareRootCandidates(rule: ConfigurableProblemRule, answerSlot: ProblemAnswerSlot): MathProblem[] {
  const numeratorRange = normalizeRange(rule.left) ?? { min: 1, max: 9 };
  const radicandRange = normalizeRange(rule.right) ?? { min: 2, max: 12 };
  const numeratorAnswerRange = normalizeRange(rule.result);
  const denominatorAnswerRange = normalizeRange(rule.remainder ?? null);
  const candidates: MathProblem[] = [];

  for (let numerator = Math.max(1, numeratorRange.min); numerator <= numeratorRange.max; numerator += 1) {
    for (let radicand = Math.max(2, radicandRange.min); radicand <= radicandRange.max; radicand += 1) {
      if (!isSquareFreeRootRadicand(radicand)) {
        continue;
      }

      const divisor = getGreatestCommonDivisor(numerator, radicand);
      const result = numerator / divisor;
      const remainder = radicand / divisor;
      if (
        remainder <= 1
        || !containsRange(numeratorAnswerRange, result)
        || !containsRange(denominatorAnswerRange, remainder)
      ) {
        continue;
      }

      const problemWithoutAnswer = {
        kind: 'squareRoot' as const,
        left: numerator,
        operator: '=' as const,
        right: radicand,
        result,
        remainder,
        answerSlot,
        answerMode: 'squareRootRationalize' as const,
        rootMode: 'rationalize' as const,
      };
      candidates.push({
        ...problemWithoutAnswer,
        answer: getAnswerValue(problemWithoutAnswer),
      });
    }
  }

  return candidates;
}

/** √2、√3、√5、√7の値を小数点下3けたで答える候補を集めます。 */
function collectDecimalValueSquareRootCandidates(rule: ConfigurableProblemRule, answerSlot: ProblemAnswerSlot): MathProblem[] {
  const radicandRange = normalizeRange(rule.left);
  const resultRange = normalizeDecimalRange(rule.result, DEFAULT_SQUARE_ROOT_DECIMAL_PLACES);
  const decimalPlaces = normalizeDecimalPlaces(rule.resultDecimalPlaces ?? DEFAULT_SQUARE_ROOT_DECIMAL_PLACES);
  const candidates: MathProblem[] = [];

  SQUARE_ROOT_DECIMAL_RADICANDS.forEach((radicand) => {
    if (!containsRange(radicandRange, radicand)) {
      return;
    }

    const result = roundToDecimalPlaces(Math.sqrt(radicand), decimalPlaces);
    const resultUnit = Math.round(result * getDecimalScale(decimalPlaces));
    if (!containsRange(resultRange, resultUnit)) {
      return;
    }

    const problemWithoutAnswer = {
      kind: 'squareRoot' as const,
      left: radicand,
      operator: '=' as const,
      right: 0,
      result,
      remainder: 1,
      answerSlot,
      rootMode: 'decimalValue' as const,
      resultDecimalPlaces: decimalPlaces,
    };
    candidates.push({
      ...problemWithoutAnswer,
      answer: getAnswerValue(problemWithoutAnswer),
    });
  });

  return candidates;
}

/** √を含む数の大小を比べ、大きい項の番号を答える候補を集めます。 */
function collectSquareRootComparisonCandidates(rule: ConfigurableProblemRule, answerSlot: ProblemAnswerSlot): MathProblem[] {
  const answerRange = normalizeRange(rule.result);
  const candidates: MathProblem[] = [];

  SQUARE_ROOT_COMPARISON_SETS.forEach((terms) => {
    const result = getLargestSquareRootComparisonTermIndex(terms);
    if (!containsRange(answerRange, result)) {
      return;
    }

    const problemWithoutAnswer = {
      kind: 'squareRoot' as const,
      left: terms[0]?.value ?? 0,
      operator: '=' as const,
      right: terms[1]?.value ?? 0,
      result,
      remainder: terms.length,
      answerSlot,
      rootMode: 'compare' as const,
      rootComparisonTerms: terms.map((term) => ({ ...term })),
    };
    candidates.push({
      ...problemWithoutAnswer,
      answer: getAnswerValue(problemWithoutAnswer),
    });
  });

  return candidates;
}

/** 平方根・√の整理・√式の問題候補を、ルールに合わせて集めます。 */
function collectSquareRootCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || answerSlot !== 'result') {
    return [];
  }

  const rootMode = getSquareRootMode(rule);
  if (isSquareRootExpressionMode(rootMode)) {
    return collectSquareRootExpressionCandidates(rule, rootMode);
  }
  if (rootMode === 'absoluteSquare') {
    return collectAbsoluteSquareRootCandidates(rule, answerSlot);
  }
  if (rootMode === 'fraction') {
    return collectFractionSquareRootCandidates(rule, answerSlot);
  }
  if (rootMode === 'rationalize') {
    return collectRationalizeSquareRootCandidates(rule, answerSlot);
  }
  if (rootMode === 'decimalValue') {
    return collectDecimalValueSquareRootCandidates(rule, answerSlot);
  }
  if (rootMode === 'compare') {
    return collectSquareRootComparisonCandidates(rule, answerSlot);
  }

  const leftRange = toLoopRange(normalizeRange(rule.left));
  const resultRange = normalizeRange(rule.result);
  const remainderRange = normalizeRange(rule.remainder ?? null);
  const candidates: MathProblem[] = [];

  for (let left = Math.max(1, leftRange.min); left <= leftRange.max; left += 1) {
    const rootParts = getSquareRootParts(left);
    if (!rootParts) {
      continue;
    }

    const { coefficient, radicand } = rootParts;
    if (rootMode !== 'simplify' && radicand !== 1) {
      continue;
    }
    if (rootMode === 'simplify' && (coefficient <= 1 || radicand <= 1)) {
      continue;
    }
    if (!containsRange(resultRange, coefficient) || !containsRange(remainderRange, radicand)) {
      continue;
    }

    const answerMode = rootMode === 'pair'
      ? 'squareRootPair' as const
      : rootMode === 'simplify'
        ? 'squareRootSimplify' as const
        : undefined;
    const problemWithoutAnswer = {
      kind: 'squareRoot' as const,
      left,
      operator: '=' as const,
      right: radicand,
      result: coefficient,
      remainder: radicand,
      answerSlot,
      rootMode,
      ...(answerMode ? { answerMode } : {}),
    };
    const answer = getAnswerValue(problemWithoutAnswer);
    if (!isAnswerInInputRange(answer)) {
      continue;
    }

    candidates.push({
      ...problemWithoutAnswer,
      answer,
    });
  }

  return candidates;
}

/** 範囲を指定された下限・上限内へ切り詰め、空になる場合はnullにします。 */
function clampRange(range: NumberRange, min: number, max: number): NumberRange | null {
  const clamped = {
    min: Math.max(min, range.min),
    max: Math.min(max, range.max),
  };

  return clamped.min <= clamped.max ? clamped : null;
}

/** 分母に対して使える分子のループ範囲を、0以上分母未満に整えます。 */
function toFractionNumeratorLoopRange(range: NumberRange | null, denominator: number): NumberRange | null {
  const fallbackRange = { min: 1, max: denominator - 1 };
  return clampRange(range ?? fallbackRange, 0, denominator - 1);
}

/** 同分母の分数加減問題の候補を、分母と分子範囲から集めます。 */
function collectSameDenominatorFractionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || (operator !== '+' && operator !== '-')) {
    return [];
  }

  const denominatorRange = normalizeRange(rule.denominator ?? [2, 9]) ?? DEFAULT_FRACTION_DENOMINATOR_RANGE;
  const leftRange = normalizeRange(rule.left);
  const rightRange = normalizeRange(rule.right);
  const resultRange = normalizeRange(rule.result);
  const candidates: MathProblem[] = [];

  for (let denominator = denominatorRange.min; denominator <= denominatorRange.max; denominator += 1) {
    if (denominator < 2) {
      continue;
    }

    const leftLoopRange = toFractionNumeratorLoopRange(leftRange, denominator);
    const rightLoopRange = toFractionNumeratorLoopRange(rightRange, denominator);
    if (!leftLoopRange || !rightLoopRange) {
      continue;
    }

    for (let left = leftLoopRange.min; left <= leftLoopRange.max; left += 1) {
      for (let right = rightLoopRange.min; right <= rightLoopRange.max; right += 1) {
        const result = operator === '+' ? left + right : left - right;
        if (result < 0 || result > denominator || !containsRange(resultRange, result)) {
          continue;
        }

        const problemWithoutAnswer = {
          kind: 'sameDenominatorFraction' as const,
          left,
          operator,
          right,
          result,
          answerSlot,
          denominator,
        };
        const answer = getAnswerValue(problemWithoutAnswer);
        if (!isAnswerInInputRange(answer)) {
          continue;
        }

        candidates.push({
          ...problemWithoutAnswer,
          answer,
        });
      }
    }
  }

  return candidates;
}

/** 等しい分数の問題候補を、既約分数とその拡大形から作ります。 */
function collectEquivalentFractionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot) {
    return [];
  }

  const leftRange = normalizeRange(rule.left);
  const rightRange = normalizeRange(rule.right);
  const leftDenominatorRange = normalizeRange(rule.leftDenominator ?? null);
  const rightDenominatorRange = normalizeRange(rule.rightDenominator ?? null);
  const candidates: MathProblem[] = [];

  const addCandidate = (
    left: number,
    leftDenominator: number,
    right: number,
    rightDenominator: number,
  ): void => {
    if (
      !containsRange(leftRange, left)
      || !containsRange(rightRange, right)
      || !containsRange(leftDenominatorRange, leftDenominator)
      || !containsRange(rightDenominatorRange, rightDenominator)
    ) {
      return;
    }

    const problemWithoutAnswer = {
      kind: 'equivalentFraction' as const,
      left,
      operator: '=' as const,
      right,
      result: 0,
      answerSlot,
      leftDenominator,
      rightDenominator,
    };
    const answer = getAnswerValue(problemWithoutAnswer);
    if (!isAnswerInInputRange(answer)) {
      return;
    }

    candidates.push({
      ...problemWithoutAnswer,
      answer,
    });
  };

  for (let baseDenominator = 2; baseDenominator <= 9; baseDenominator += 1) {
    for (let baseNumerator = 1; baseNumerator < baseDenominator; baseNumerator += 1) {
      if (getGreatestCommonDivisor(baseNumerator, baseDenominator) !== 1) {
        continue;
      }

      for (let scale = 2; scale <= 4; scale += 1) {
        const expandedNumerator = baseNumerator * scale;
        const expandedDenominator = baseDenominator * scale;
        addCandidate(expandedNumerator, expandedDenominator, baseNumerator, baseDenominator);
        addCandidate(baseNumerator, baseDenominator, expandedNumerator, expandedDenominator);
      }
    }
  }

  return candidates;
}

/** 異分母の分数加減問題を、最小公倍数で通分しながら候補化します。 */
function collectDifferentDenominatorFractionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || (operator !== '+' && operator !== '-')) {
    return [];
  }

  const leftDenominatorRange = normalizeRange(rule.leftDenominator ?? rule.denominator ?? [2, 9])
    ?? DEFAULT_FRACTION_DENOMINATOR_RANGE;
  const rightDenominatorRange = normalizeRange(rule.rightDenominator ?? rule.denominator ?? [2, 9])
    ?? DEFAULT_FRACTION_DENOMINATOR_RANGE;
  const resultDenominatorRange = normalizeRange(rule.resultDenominator ?? null);
  const leftRange = normalizeRange(rule.left);
  const rightRange = normalizeRange(rule.right);
  const resultRange = normalizeRange(rule.result);
  const candidates: MathProblem[] = [];

  for (
    let leftDenominator = leftDenominatorRange.min;
    leftDenominator <= leftDenominatorRange.max;
    leftDenominator += 1
  ) {
    if (leftDenominator < 2) {
      continue;
    }

    const leftLoopRange = toFractionNumeratorLoopRange(leftRange, leftDenominator);
    if (!leftLoopRange) {
      continue;
    }

    for (
      let rightDenominator = rightDenominatorRange.min;
      rightDenominator <= rightDenominatorRange.max;
      rightDenominator += 1
    ) {
      if (rightDenominator < 2 || rightDenominator === leftDenominator) {
        continue;
      }

      const resultDenominator = getLeastCommonMultiple(leftDenominator, rightDenominator);
      if (!containsRange(resultDenominatorRange, resultDenominator)) {
        continue;
      }

      const rightLoopRange = toFractionNumeratorLoopRange(rightRange, rightDenominator);
      if (!rightLoopRange) {
        continue;
      }

      const leftScale = resultDenominator / leftDenominator;
      const rightScale = resultDenominator / rightDenominator;
      for (let left = leftLoopRange.min; left <= leftLoopRange.max; left += 1) {
        for (let right = rightLoopRange.min; right <= rightLoopRange.max; right += 1) {
          const result = operator === '+'
            ? left * leftScale + right * rightScale
            : left * leftScale - right * rightScale;
          if (result < 0 || result > resultDenominator || !containsRange(resultRange, result)) {
            continue;
          }

          const problemWithoutAnswer = {
            kind: 'differentDenominatorFraction' as const,
            left,
            operator,
            right,
            result,
            answerSlot,
            leftDenominator,
            rightDenominator,
            resultDenominator,
          };
          const answer = getAnswerValue(problemWithoutAnswer);
          if (!isAnswerInInputRange(answer)) {
            continue;
          }

          candidates.push({
            ...problemWithoutAnswer,
            answer,
          });
        }
      }
    }
  }

  return candidates;
}

/** 分数のかけ算・わり算問題を、分子分母の範囲から候補化します。 */
function collectFractionProductQuotientCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || (operator !== '×' && operator !== '÷')) {
    return [];
  }

  const leftDenominatorRange = normalizeRange(rule.leftDenominator ?? rule.denominator ?? [2, 6])
    ?? DEFAULT_FRACTION_DENOMINATOR_RANGE;
  const rightDenominatorRange = normalizeRange(rule.rightDenominator ?? rule.denominator ?? [2, 6])
    ?? DEFAULT_FRACTION_DENOMINATOR_RANGE;
  const resultDenominatorRange = normalizeRange(rule.resultDenominator ?? null);
  const leftRange = normalizeRange(rule.left);
  const rightRange = normalizeRange(rule.right);
  const resultRange = normalizeRange(rule.result);
  const candidates: MathProblem[] = [];

  for (
    let leftDenominator = leftDenominatorRange.min;
    leftDenominator <= leftDenominatorRange.max;
    leftDenominator += 1
  ) {
    if (leftDenominator < 2) {
      continue;
    }

    const leftLoopRange = toFractionNumeratorLoopRange(leftRange, leftDenominator);
    if (!leftLoopRange) {
      continue;
    }

    for (
      let rightDenominator = rightDenominatorRange.min;
      rightDenominator <= rightDenominatorRange.max;
      rightDenominator += 1
    ) {
      if (rightDenominator < 2) {
        continue;
      }

      const rightLoopRange = toFractionNumeratorLoopRange(rightRange, rightDenominator);
      if (!rightLoopRange) {
        continue;
      }

      for (let left = leftLoopRange.min; left <= leftLoopRange.max; left += 1) {
        for (let right = rightLoopRange.min; right <= rightLoopRange.max; right += 1) {
          if (operator === '÷' && right === 0) {
            continue;
          }

          const result = operator === '×' ? left * right : left * rightDenominator;
          const resultDenominator = operator === '×'
            ? leftDenominator * rightDenominator
            : leftDenominator * right;
          if (
            resultDenominator <= 0
            || !containsRange(resultDenominatorRange, resultDenominator)
            || !containsRange(resultRange, result)
          ) {
            continue;
          }

          const problemWithoutAnswer = {
            kind: 'fractionProductQuotient' as const,
            left,
            operator,
            right,
            result,
            answerSlot,
            leftDenominator,
            rightDenominator,
            resultDenominator,
          };
          const answer = getAnswerValue(problemWithoutAnswer);
          if (!isAnswerInInputRange(answer)) {
            continue;
          }

          candidates.push({
            ...problemWithoutAnswer,
            answer,
          });
        }
      }
    }
  }

  return candidates;
}

/** 問題の種類を見て、専用の候補生成関数へ振り分けます。 */
function collectProblemCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  if (rule.kind === 'clockTime') {
    return collectClockTimeCandidates(rule);
  }

  if (rule.kind === 'clockMinuteConversion') {
    return collectClockMinuteConversionCandidates(rule);
  }

  if (rule.kind === 'shapeArea') {
    return collectShapeAreaCandidates(rule);
  }

  if (rule.kind === 'verticalArithmetic') {
    return collectVerticalArithmeticCandidates(rule);
  }

  if (rule.kind === 'missingDigitArithmetic') {
    return collectMissingDigitArithmeticCandidates(rule);
  }

  if (rule.kind === 'integerDivision') {
    return collectIntegerDivisionCandidates(rule);
  }

  if (rule.kind === 'squareRoot') {
    return collectSquareRootCandidates(rule);
  }

  if (rule.kind === 'equivalentFraction') {
    return collectEquivalentFractionCandidates(rule);
  }

  if (rule.kind === 'sameDenominatorFraction') {
    return collectSameDenominatorFractionCandidates(rule);
  }

  if (rule.kind === 'differentDenominatorFraction') {
    return collectDifferentDenominatorFractionCandidates(rule);
  }

  if (rule.kind === 'fractionProductQuotient') {
    return collectFractionProductQuotientCandidates(rule);
  }

  return collectIntegerProblemCandidates(rule);
}

/** 旧形式の問題ルールIDか、新形式の構造化ルールかを見分けます。 */
function isLegacyProblemRule(problemRule: ProblemRuleDefinition): problemRule is ProblemRule {
  return typeof problemRule === 'string';
}

/** 旧形式も新形式も、候補生成で扱いやすい構造化ルール配列へそろえます。 */
function normalizeProblemRules(problemRule: ProblemRuleDefinition): ConfigurableProblemRule[] {
  if (isLegacyProblemRule(problemRule)) {
    return LEGACY_PROBLEM_RULES[problemRule] ?? LEGACY_PROBLEM_RULES.plusOne;
  }

  return Array.isArray(problemRule) ? [...problemRule] : [problemRule];
}

/** 範囲指定から問題を1問作ります。条件に合う式がなければnullを返します。 */
function createProblemFromConfig(rule: ConfigurableProblemRule): MathProblem | null {
  if (rule.kind === 'decimal') {
    return createDecimalProblemFromConfig(rule);
  }

  const candidates = collectProblemCandidates(rule);
  return pickRandom(candidates);
}

/** ステージやトレーナーの問題定義から、次に出す計算問題を作ります。 */
export function createProblem(problemRule: ProblemRuleDefinition): MathProblem {
  const rules = normalizeProblemRules(problemRule);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const rule = pickRandom(rules);
    if (!rule) {
      break;
    }

    const problem = createProblemFromConfig(rule);
    if (problem) {
      return problem;
    }
  }

  const right = randomBetween(0, 9);
  const result = 1 + right;
  return {
    left: 1,
    operator: '+',
    right,
    result,
    answer: result,
    answerSlot: 'result',
  };
}

/** 直前問題との比較に使うため、問題内容を同じ形式の文字列にまとめます。 */
function getProblemSignature(problem: MathProblem): string {
  return [
    problem.kind ?? 'integer',
    problem.denominator ?? '',
    problem.leftDenominator ?? '',
    problem.rightDenominator ?? '',
    problem.resultDenominator ?? '',
    problem.minuteStep ?? '',
    problem.leftDecimalPlaces ?? '',
    problem.rightDecimalPlaces ?? '',
    problem.resultDecimalPlaces ?? '',
    problem.remainder ?? '',
    problem.answerMode ?? '',
    problem.rootMode ?? '',
    problem.rootLeftRadicand ?? '',
    problem.rootRightRadicand ?? '',
    JSON.stringify(problem.rootComparisonTerms ?? ''),
    problem.hiddenDigitSlot ?? '',
    problem.left,
    problem.operator,
    problem.right,
    problem.result,
    problem.answerSlot,
  ].join('|');
}

/** 直前と同じ式が続かないよう、数回だけ引き直して問題を作ります。 */
export function createProblemAvoiding(
  problemRule: ProblemRuleDefinition,
  previousProblem: MathProblem | null | undefined,
): MathProblem {
  if (!previousProblem) {
    return createProblem(problemRule);
  }

  const previousSignature = getProblemSignature(previousProblem);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nextProblem = createProblem(problemRule);
    if (getProblemSignature(nextProblem) !== previousSignature) {
      return nextProblem;
    }
  }

  return createProblem(problemRule);
}

/** 複数ステージの問題ルールから1つを選び、普通の問題として作ります。 */
export function createProblemFromRuleSetAvoiding(
  problemRules: ProblemRuleDefinition[],
  previousProblem: MathProblem | null | undefined,
): MathProblem {
  const normalizedRules = problemRules.length > 0
    ? problemRules.slice(0, 5)
    : ['plusOne' as ProblemRuleDefinition];
  /** ボス戦の問題形式候補から、今回使う問題ルールを1つ選びます。 */
  const pickProblemRule = (): ProblemRuleDefinition => pickRandom(normalizedRules) ?? 'plusOne';

  if (!previousProblem) {
    return createProblem(pickProblemRule());
  }

  const previousSignature = getProblemSignature(previousProblem);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const nextProblem = createProblem(pickProblemRule());
    if (getProblemSignature(nextProblem) !== previousSignature) {
      return nextProblem;
    }
  }

  return createProblem(pickProblemRule());
}

/** 同分母分数問題として扱えるか、必要な分母情報まで含めて判定します。 */
export function isSameDenominatorFractionProblem(
  problem: MathProblem,
): problem is MathProblem & { kind: 'sameDenominatorFraction'; denominator: number } {
  return problem.kind === 'sameDenominatorFraction' && typeof problem.denominator === 'number';
}

/** 時計を読む問題かどうかを判定します。 */
export function isClockTimeProblem(problem: MathProblem): problem is MathProblem & { kind: 'clockTime' } {
  return problem.kind === 'clockTime';
}

/** 分を時間と分へ直す問題かどうかを判定します。 */
export function isClockMinuteConversionProblem(
  problem: MathProblem,
): problem is MathProblem & { kind: 'clockMinuteConversion' } {
  return problem.kind === 'clockMinuteConversion';
}

/** 時間と分を別々に答える、二枠形式の時間変換問題かを判定します。 */
export function usesClockMinuteConversionPairAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'clockMinuteConversion'; remainder: number; answerMode: 'clockHourMinute' } {
  return isClockMinuteConversionProblem(problem)
    && problem.answerMode === 'clockHourMinute'
    && typeof problem.remainder === 'number';
}

/** 小数問題かどうかを判定します。 */
export function isDecimalProblem(problem: MathProblem): problem is MathProblem & { kind: 'decimal' } {
  return problem.kind === 'decimal';
}

/** あまり情報を持つ整数わり算問題かどうかを判定します。 */
/** Checks whether the problem asks for rectangle area or a missing side. */
export function isShapeAreaProblem(problem: MathProblem): problem is MathProblem & { kind: 'shapeArea' } {
  return problem.kind === 'shapeArea';
}

/** Checks whether the problem should be shown as a vertical calculation. */
export function isVerticalArithmeticProblem(problem: MathProblem): problem is MathProblem & { kind: 'verticalArithmetic' } {
  return problem.kind === 'verticalArithmetic';
}

/** Checks whether the problem hides one digit inside a two-digit equation. */
export function isMissingDigitArithmeticProblem(
  problem: MathProblem,
): problem is MathProblem & { kind: 'missingDigitArithmetic'; hiddenDigitSlot: ProblemHiddenDigitSlot } {
  return problem.kind === 'missingDigitArithmetic' && typeof problem.hiddenDigitSlot === 'string';
}

export function isIntegerDivisionProblem(
  problem: MathProblem,
): problem is MathProblem & { kind: 'integerDivision'; remainder: number } {
  return problem.kind === 'integerDivision' && typeof problem.remainder === 'number';
}

/** 商とあまりを別々に答えるわり算問題かどうかを判定します。 */
export function usesQuotientRemainderAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'integerDivision'; remainder: number; answerMode: 'quotientRemainder' } {
  return isIntegerDivisionProblem(problem) && problem.answerMode === 'quotientRemainder';
}

/** √問題として扱えるか、根号内数とモード情報まで含めて判定します。 */
export function isSquareRootProblem(
  problem: MathProblem,
): problem is MathProblem & { kind: 'squareRoot'; remainder: number; rootMode: SquareRootProblemMode } {
  return problem.kind === 'squareRoot'
    && typeof problem.remainder === 'number'
    && typeof problem.rootMode === 'string';
}

/** 正負2つの平方根を答える√問題かどうかを判定します。 */
export function usesSquareRootPairAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'squareRoot'; remainder: number; answerMode: 'squareRootPair' } {
  return isSquareRootProblem(problem) && problem.answerMode === 'squareRootPair';
}

/** √を整理して係数と根号内数を答える問題かどうかを判定します。 */
export function usesSquareRootSimplifyAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'squareRoot'; remainder: number; answerMode: 'squareRootSimplify' } {
  return isSquareRootProblem(problem) && problem.answerMode === 'squareRootSimplify';
}

/** √分数を分子と分母で答える問題かどうかを判定します。 */
export function usesSquareRootFractionAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'squareRoot'; remainder: number; answerMode: 'squareRootFraction' } {
  return isSquareRootProblem(problem) && problem.answerMode === 'squareRootFraction';
}

/** 分母の√をなくし、分子の√係数と分母で答える問題かどうかを判定します。 */
export function usesSquareRootRationalizeAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'squareRoot'; remainder: number; answerMode: 'squareRootRationalize' } {
  return isSquareRootProblem(problem) && problem.answerMode === 'squareRootRationalize';
}

/** √2などの値を小数で答える問題かどうかを判定します。 */
export function usesSquareRootDecimalValueAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'squareRoot'; remainder: number; rootMode: 'decimalValue' } {
  return isSquareRootProblem(problem) && problem.rootMode === 'decimalValue';
}

/** √を含む数の大小を番号で答える問題かどうかを判定します。 */
export function usesSquareRootComparisonAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'squareRoot'; remainder: number; rootMode: 'compare'; rootComparisonTerms: SquareRootComparisonTerm[] } {
  return isSquareRootProblem(problem)
    && problem.rootMode === 'compare'
    && Array.isArray(problem.rootComparisonTerms);
}

/** √項どうしの加減結果を、係数と根号内数で答える問題かを判定します。 */
export function usesSquareRootExpressionAnswer(
  problem: MathProblem,
): problem is MathProblem & {
  kind: 'squareRoot';
  remainder: number;
  answerMode: 'squareRootExpression';
  rootLeftRadicand: number;
  rootRightRadicand: number;
} {
  return isSquareRootProblem(problem)
    && problem.answerMode === 'squareRootExpression'
    && typeof problem.rootLeftRadicand === 'number'
    && typeof problem.rootRightRadicand === 'number';
}

/** 係数1を空入力として許せる√形式かどうかを返します。 */
export function usesOptionalSquareRootCoefficientInput(problem: MathProblem): boolean {
  return usesSquareRootSimplifyAnswer(problem)
    || usesSquareRootExpressionAnswer(problem)
    || usesSquareRootRationalizeAnswer(problem);
}

/** 今の問題が、前半と後半の二つの入力欄を使う形式かを判定します。 */
export function usesTwoPartAnswer(problem: MathProblem): boolean {
  return usesQuotientRemainderAnswer(problem)
    || usesClockMinuteConversionPairAnswer(problem)
    || usesSquareRootPairAnswer(problem)
    || usesSquareRootSimplifyAnswer(problem)
    || usesSquareRootFractionAnswer(problem)
    || usesSquareRootRationalizeAnswer(problem)
    || usesSquareRootExpressionAnswer(problem);
}

/** 4択や全て選べのように、画面上のカード選択で答える問題かを判定します。 */
export function usesChoiceAnswer(problem: MathProblem): boolean {
  return problem.answerMode === 'choiceGrid'
    || problem.answerMode === 'choiceRow'
    || problem.answerMode === 'choiceColumn'
    || problem.answerMode === 'multiSelect';
}

/** 複数カードを選んでから答える、全て選べ形式の問題かを判定します。 */
export function usesMultiSelectChoiceAnswer(problem: MathProblem): boolean {
  return problem.answerMode === 'multiSelect';
}

/** 等しい分数問題として扱えるか、左右の分母情報まで含めて判定します。 */
export function isEquivalentFractionProblem(
  problem: MathProblem,
): problem is MathProblem & {
  kind: 'equivalentFraction';
  leftDenominator: number;
  rightDenominator: number;
} {
  return problem.kind === 'equivalentFraction'
    && typeof problem.leftDenominator === 'number'
    && typeof problem.rightDenominator === 'number';
}

/** 異分母の分数加減問題として扱えるか、必要な分母情報まで含めて判定します。 */
export function isDifferentDenominatorFractionProblem(
  problem: MathProblem,
): problem is MathProblem & {
  kind: 'differentDenominatorFraction';
  leftDenominator: number;
  rightDenominator: number;
  resultDenominator: number;
} {
  return problem.kind === 'differentDenominatorFraction'
    && typeof problem.leftDenominator === 'number'
    && typeof problem.rightDenominator === 'number'
    && typeof problem.resultDenominator === 'number';
}

/** 分数のかけ算・わり算問題として扱えるか、必要な分母情報まで含めて判定します。 */
export function isFractionProductQuotientProblem(
  problem: MathProblem,
): problem is MathProblem & {
  kind: 'fractionProductQuotient';
  leftDenominator: number;
  rightDenominator: number;
  resultDenominator: number;
} {
  return problem.kind === 'fractionProductQuotient'
    && typeof problem.leftDenominator === 'number'
    && typeof problem.rightDenominator === 'number'
    && typeof problem.resultDenominator === 'number';
}

/** いずれかの分数問題として扱えるかをまとめて判定します。 */
export function isFractionProblem(
  problem: MathProblem,
): problem is MathProblem & {
  kind: 'sameDenominatorFraction' | 'equivalentFraction' | 'differentDenominatorFraction' | 'fractionProductQuotient';
} {
  return isSameDenominatorFractionProblem(problem)
    || isEquivalentFractionProblem(problem)
    || isDifferentDenominatorFractionProblem(problem)
    || isFractionProductQuotientProblem(problem);
}

/** 分数の一部を、空欄指定に合わせて`□/数`のような表示用文字列にします。 */
function formatFractionPart(
  numerator: number,
  denominator: number,
  numeratorSlot: boolean,
  denominatorSlot: boolean,
): string {
  return `${numeratorSlot ? '□' : numerator}/${denominatorSlot ? '□' : denominator}`;
}

/** 小数値を表示用に整え、末尾の不要な0を削ります。 */
function formatDecimalValue(value: number, decimalPlaces: number): string {
  const fixed = value.toFixed(decimalPlaces);
  return fixed
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}

/** √項を、係数1なら省略した表示用文字列にします。 */
function formatSquareRootTerm(coefficient: number, radicand: number): string {
  return coefficient === 1 ? `√${radicand}` : `${coefficient}√${radicand}`;
}

/** √の中で二乗する数を、負の数だけカッコ付きにして表示します。 */
export function formatSquareRootSquaredBase(value: number): string {
  return value < 0 ? `(${value})²` : `${value}²`;
}

/** Formats a two-digit value with exactly one requested digit replaced by a blank box. */
function formatTwoDigitValueWithHiddenDigit(value: number, slot: ProblemHiddenDigitSlot): string {
  if (value < 10 || value > 99) {
    return String(value);
  }

  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return slot.endsWith('Tens') ? `□${ones}` : `${tens}□`;
}

/** Formats the left, right, or result number for a missing-digit problem. */
function formatMissingDigitProblemPart(
  problem: MathProblem & { kind: 'missingDigitArithmetic'; hiddenDigitSlot: ProblemHiddenDigitSlot },
  part: 'left' | 'right' | 'result',
): string {
  const value = part === 'left'
    ? problem.left
    : part === 'right'
      ? problem.right
      : problem.result;
  return problem.hiddenDigitSlot.startsWith(part)
    ? formatTwoDigitValueWithHiddenDigit(value, problem.hiddenDigitSlot)
    : String(value);
}

/** Pads a vertical-calculation line so the columns remain easy to scan. */
function padVerticalProblemLine(value: string, width: number): string {
  return value.padStart(width, ' ');
}

/** 問題一覧やテストで使う、空欄つきの問題文を作ります。 */
export function formatProblem(problem: MathProblem): string {
  if (isClockTimeProblem(problem)) {
    if (problem.answerSlot === 'result') {
      return `時計 ${formatClockTime(problem.left, problem.right)} = □`;
    }

    const hour = problem.answerSlot === 'left' ? '□' : String(problem.left);
    const minute = problem.answerSlot === 'right' ? '□' : String(problem.right);
    const time = problem.right === 0 && problem.answerSlot !== 'right'
      ? `${hour}時`
      : `${hour}時${minute}分`;
    return `時計 ${time}`;
  }

  if (isClockMinuteConversionProblem(problem)) {
    const totalMinutes = problem.answerSlot === 'left' ? '□' : String(problem.left);
    if (usesClockMinuteConversionPairAnswer(problem)) {
      return `${totalMinutes}分 = □時間□分`;
    }

    const hour = problem.answerSlot === 'right' ? '□' : String(problem.right);
    const minute = problem.answerSlot === 'result' ? '□' : String(problem.result);
    return `${totalMinutes}分 = ${hour}時間${minute}分`;
  }

  if (isDecimalProblem(problem)) {
    const left = problem.answerSlot === 'left'
      ? '□'
      : formatDecimalValue(problem.left, getProblemDecimalPlaces(problem, 'left'));
    const right = problem.answerSlot === 'right'
      ? '□'
      : formatDecimalValue(problem.right, getProblemDecimalPlaces(problem, 'right'));
    const result = problem.answerSlot === 'result'
      ? '□'
      : formatDecimalValue(problem.result, getProblemDecimalPlaces(problem, 'result'));
    return `${left} ${problem.operator} ${right} = ${result}`;
  }

  if (isShapeAreaProblem(problem)) {
    const left = problem.answerSlot === 'left' ? '□' : String(problem.left);
    const right = problem.answerSlot === 'right' ? '□' : String(problem.right);
    const result = problem.answerSlot === 'result' ? '□' : String(problem.result);
    return `図形 たて ${left} よこ ${right}\nひろさ = ${result}`;
  }

  if (isVerticalArithmeticProblem(problem)) {
    const left = problem.answerSlot === 'left' ? '□' : String(problem.left);
    const right = problem.answerSlot === 'right' ? '□' : String(problem.right);
    const result = problem.answerSlot === 'result' ? '□' : String(problem.result);
    const width = Math.max(left.length, right.length + 1, result.length + 2);
    return [
      'ひっ算',
      padVerticalProblemLine(left, width),
      padVerticalProblemLine(`${problem.operator}${right}`, width),
      padVerticalProblemLine(`= ${result}`, width),
    ].join('\n');
  }

  if (isMissingDigitArithmeticProblem(problem)) {
    const left = formatMissingDigitProblemPart(problem, 'left');
    const right = formatMissingDigitProblemPart(problem, 'right');
    const result = formatMissingDigitProblemPart(problem, 'result');
    return `虫食い算\n${left} ${problem.operator} ${right} = ${result}`;
  }

  if (isIntegerDivisionProblem(problem)) {
    const left = problem.answerSlot === 'left' ? '□' : String(problem.left);
    const right = problem.answerSlot === 'right' ? '□' : String(problem.right);
    const result = problem.answerSlot === 'result' ? '□' : String(problem.result);
    if (usesQuotientRemainderAnswer(problem)) {
      return `${left} ${problem.operator} ${right} = ${result} あまり □`;
    }

    return `${left} ${problem.operator} ${right} = ${result}`;
  }

  if (isSquareRootProblem(problem)) {
    if (usesSquareRootPairAnswer(problem)) {
      return `${problem.left}の√ = □と-□`;
    }
    if (usesSquareRootComparisonAnswer(problem)) {
      const terms = problem.rootComparisonTerms
        .map((term, index) => `${index + 1}:${formatSquareRootComparisonTerm(term)}`)
        .join(' ');
      return `大きいほう ${terms} = □`;
    }
    if (usesSquareRootDecimalValueAnswer(problem)) {
      return `小数点下${getProblemAnswerDecimalPlaces(problem)}けたまで √${problem.left} = □`;
    }
    if (usesSquareRootFractionAnswer(problem)) {
      return `√分数 = 分数`;
    }
    if (usesSquareRootRationalizeAnswer(problem)) {
      return `${problem.left}/√${problem.right} = □√${problem.right}/□`;
    }
    if (usesSquareRootExpressionAnswer(problem)) {
      const left = formatSquareRootTerm(problem.left, problem.rootLeftRadicand);
      const right = formatSquareRootTerm(problem.right, problem.rootRightRadicand);
      return `${left} ${problem.operator} ${right} = □√□`;
    }
    if (usesSquareRootSimplifyAnswer(problem)) {
      return `√${problem.left} = □√□`;
    }
    if (problem.rootMode === 'absoluteSquare') {
      return `√${formatSquareRootSquaredBase(problem.left)} = □`;
    }

    return `√${problem.left} = □`;
  }

  if (isSameDenominatorFractionProblem(problem)) {
    const left = formatFractionPart(problem.left, problem.denominator, problem.answerSlot === 'left', false);
    const right = formatFractionPart(problem.right, problem.denominator, problem.answerSlot === 'right', false);
    const result = formatFractionPart(problem.result, problem.denominator, problem.answerSlot === 'result', false);
    return `${left} ${problem.operator} ${right} = ${result}`;
  }

  if (isEquivalentFractionProblem(problem)) {
    const left = formatFractionPart(
      problem.left,
      problem.leftDenominator,
      problem.answerSlot === 'left',
      problem.answerSlot === 'leftDenominator',
    );
    const right = formatFractionPart(
      problem.right,
      problem.rightDenominator,
      problem.answerSlot === 'right',
      problem.answerSlot === 'rightDenominator',
    );
    return `${left} = ${right}`;
  }

  if (isDifferentDenominatorFractionProblem(problem)) {
    const left = formatFractionPart(
      problem.left,
      problem.leftDenominator,
      problem.answerSlot === 'left',
      problem.answerSlot === 'leftDenominator',
    );
    const right = formatFractionPart(
      problem.right,
      problem.rightDenominator,
      problem.answerSlot === 'right',
      problem.answerSlot === 'rightDenominator',
    );
    const result = formatFractionPart(
      problem.result,
      problem.resultDenominator,
      problem.answerSlot === 'result',
      problem.answerSlot === 'resultDenominator',
    );
    return `${left} ${problem.operator} ${right} = ${result}`;
  }

  if (isFractionProductQuotientProblem(problem)) {
    const left = formatFractionPart(
      problem.left,
      problem.leftDenominator,
      problem.answerSlot === 'left',
      problem.answerSlot === 'leftDenominator',
    );
    const right = formatFractionPart(
      problem.right,
      problem.rightDenominator,
      problem.answerSlot === 'right',
      problem.answerSlot === 'rightDenominator',
    );
    const result = formatFractionPart(
      problem.result,
      problem.resultDenominator,
      problem.answerSlot === 'result',
      problem.answerSlot === 'resultDenominator',
    );
    return `${left} ${problem.operator} ${right} = ${result}`;
  }

  const left = problem.answerSlot === 'left' ? '□' : String(problem.left);
  const right = problem.answerSlot === 'right' ? '□' : String(problem.right);
  const result = problem.answerSlot === 'result' ? '□' : String(problem.result);
  return `${left} ${problem.operator} ${right} = ${result}`;
}

/** 正解表示用に、問題の種類に合う答え文字列を作ります。 */
export function formatProblemAnswer(problem: MathProblem): string {
  if (isClockTimeProblem(problem)) {
    return formatClockTime(problem.left, problem.right);
  }

  if (isClockMinuteConversionProblem(problem)) {
    if (usesClockMinuteConversionPairAnswer(problem)) {
      return `${problem.right}時間${problem.result}分`;
    }

    return `${problem.answer}分`;
  }

  if (isDecimalProblem(problem)) {
    return formatDecimalValue(problem.answer, getProblemAnswerDecimalPlaces(problem));
  }

  if (usesQuotientRemainderAnswer(problem)) {
    return `${problem.result}あまり${problem.remainder}`;
  }

  if (usesSquareRootPairAnswer(problem)) {
    return `${problem.result}と-${problem.result}`;
  }

  if (usesSquareRootFractionAnswer(problem)) {
    return `分子${problem.result} 分母${problem.remainder}`;
  }

  if (usesSquareRootRationalizeAnswer(problem)) {
    return `${formatSquareRootTerm(problem.result, problem.right)}/${problem.remainder}`;
  }

  if (usesSquareRootDecimalValueAnswer(problem)) {
    return problem.answer.toFixed(getProblemAnswerDecimalPlaces(problem));
  }

  if (usesSquareRootComparisonAnswer(problem)) {
    return String(problem.answer);
  }

  if (usesSquareRootSimplifyAnswer(problem) || usesSquareRootExpressionAnswer(problem)) {
    return formatSquareRootTerm(problem.result, problem.remainder);
  }

  return String(problem.answer);
}

/** 時計の時だけ答える問題で、0時/12時/24時を12時間表記としてそろえます。 */
function normalizeClockHourAnswer(hour: number): number | null {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return null;
  }

  return hour % 12 === 0 ? 12 : hour % 12;
}

/** 一枠回答を採点し、時計や小数は専用の比較で正誤を判定します。 */
export function isProblemAnswerCorrect(problem: MathProblem, submitted: number): boolean {
  if (usesMultiSelectChoiceAnswer(problem)) {
    return false;
  }

  if (isClockTimeProblem(problem) && problem.answerSlot === 'left') {
    return normalizeClockHourAnswer(submitted) === normalizeClockHourAnswer(problem.answer);
  }

  if (isDecimalProblem(problem)) {
    const scale = getDecimalScale(getProblemAnswerDecimalPlaces(problem));
    return Math.round(submitted * scale) === Math.round(problem.answer * scale);
  }

  if (usesSquareRootDecimalValueAnswer(problem)) {
    const scale = getDecimalScale(getProblemAnswerDecimalPlaces(problem));
    return Math.round(submitted * scale) === Math.round(problem.answer * scale);
  }

  if (usesTwoPartAnswer(problem)) {
    return false;
  }

  return submitted === problem.answer;
}

/** 入力された√の係数と根号内数を整理後の形に変換します。 */
function getSubmittedRootTerm(
  coefficient: number | null,
  radicand: number,
): { coefficient: number; radicand: number } | null {
  const effectiveCoefficient = coefficient ?? 1;
  const term = getSquareRootTerm(effectiveCoefficient, radicand);
  if (!term) {
    return null;
  }

  return {
    coefficient: term.coefficient,
    radicand: term.radicand,
  };
}

/** √式の二枠回答を採点し、同値だが未整理ならpartialとして返します。 */
function getSquareRootExpressionAnswerJudgement(
  problem: MathProblem & { kind: 'squareRoot'; remainder: number },
  coefficient: number | null,
  radicand: number,
): ProblemAnswerPairJudgement {
  const isExactCoefficient = problem.result === 1
    ? coefficient === null
    : coefficient === problem.result;
  if (isExactCoefficient && radicand === problem.remainder) {
    return 'correct';
  }

  const submitted = getSubmittedRootTerm(coefficient, radicand);
  if (submitted && submitted.coefficient === problem.result && submitted.radicand === problem.remainder) {
    return 'partial';
  }

  return 'wrong';
}

/** 二枠回答を問題形式ごとに採点し、正解・部分正解・不正解を返します。 */
export function getProblemAnswerPairJudgement(
  problem: MathProblem,
  quotient: number | null,
  remainder: number,
): ProblemAnswerPairJudgement {
  if (usesQuotientRemainderAnswer(problem)) {
    return quotient === problem.result && remainder === problem.remainder ? 'correct' : 'wrong';
  }

  if (usesClockMinuteConversionPairAnswer(problem)) {
    return quotient === problem.right && remainder === problem.result ? 'correct' : 'wrong';
  }

  if (usesSquareRootPairAnswer(problem)) {
    return quotient === problem.result && remainder === problem.result ? 'correct' : 'wrong';
  }

  if (usesSquareRootFractionAnswer(problem)) {
    return quotient === problem.result && remainder === problem.remainder ? 'correct' : 'wrong';
  }

  if (usesSquareRootRationalizeAnswer(problem)) {
    const isExactCoefficient = problem.result === 1
      ? quotient === null || quotient === 1
      : quotient === problem.result;
    return isExactCoefficient && remainder === problem.remainder ? 'correct' : 'wrong';
  }

  if (usesSquareRootSimplifyAnswer(problem) || usesSquareRootExpressionAnswer(problem)) {
    return getSquareRootExpressionAnswerJudgement(problem, quotient, remainder);
  }

  return 'wrong';
}
