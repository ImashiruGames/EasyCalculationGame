import {
  ConfigurableProblemRule,
  MathProblem,
  ProblemAnswerMode,
  ProblemAnswerSlot,
  ProblemDigitRule,
  ProblemNumberRange,
  ProblemOperator,
  ProblemOperatorInput,
  ProblemRemainderRule,
  SquareRootComparisonTerm,
} from '../types';

export interface NumberRange {
  min: number;
  max: number;
}

type ChoiceAnswerMode = Extract<ProblemAnswerMode, 'choiceGrid' | 'choiceRow' | 'choiceColumn' | 'multiSelect'>;

export interface SquareRootTerm {
  displayCoefficient: number;
  displayRadicand: number;
  coefficient: number;
  radicand: number;
  isSimplified: boolean;
}

const ANSWER_MIN = 0;

const ANSWER_MAX = 2359;

const DEFAULT_OPERAND_RANGE: NumberRange = { min: 0, max: 99 };

export const DEFAULT_FRACTION_DENOMINATOR_RANGE: NumberRange = { min: 2, max: 9 };

export const DEFAULT_CLOCK_HOUR_RANGE: NumberRange = { min: 1, max: 12 };

export const DEFAULT_CLOCK_MINUTE_RANGE: NumberRange = { min: 0, max: 59 };

const DEFAULT_DECIMAL_PLACES = 1;

export const DEFAULT_SQUARE_ROOT_DECIMAL_PLACES = 3;

/** 選択式として扱うanswerModeだけを取り出し、それ以外なら未指定として返します。 */
export function getChoiceAnswerMode(rule: ConfigurableProblemRule): ChoiceAnswerMode | undefined {
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

/** 指定範囲の整数をランダムに1つ返します。 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 分数の約分などで使う最大公約数を求めます。 */
export function getGreatestCommonDivisor(left: number, right: number): number {
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
export function getLeastCommonMultiple(left: number, right: number): number {
  return Math.abs(left * right) / getGreatestCommonDivisor(left, right);
}

/** 候補配列からランダムに1つ選び、候補がなければnullを返します。 */
export function pickRandom<T>(values: T[]): T | null {
  if (values.length === 0) {
    return null;
  }

  return values[Math.floor(Math.random() * values.length)];
}

/** CSVで使える演算子の別名を、画面と計算で使う記号へそろえます。 */
export function normalizeOperator(operator: ProblemOperatorInput): ProblemOperator {
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
export function normalizeRange(range: ProblemNumberRange): NumberRange | null {
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
export function containsRange(range: NumberRange | null, value: number): boolean {
  return !range || (value >= range.min && value <= range.max);
}

/** 小数を整数単位で扱うため、けた数に応じた倍率を返します。 */
export function getDecimalScale(decimalPlaces: number): number {
  return 10 ** decimalPlaces;
}

/** 小数けた数を0から3の範囲に丸め、未指定なら既定値にします。 */
export function normalizeDecimalPlaces(decimalPlaces: number | undefined): number {
  if (decimalPlaces === undefined || !Number.isFinite(decimalPlaces)) {
    return DEFAULT_DECIMAL_PLACES;
  }

  return Math.max(0, Math.min(3, Math.floor(decimalPlaces)));
}

/** 小数の範囲指定を、指定けた数の整数単位へ変換します。 */
export function normalizeDecimalRange(range: ProblemNumberRange, decimalPlaces: number): NumberRange | null {
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
export function decimalUnitToValue(unit: number, decimalPlaces: number): number {
  return unit / getDecimalScale(decimalPlaces);
}

/** 指定した小数けたで四捨五入した数値を返します。 */
export function roundToDecimalPlaces(value: number, decimalPlaces: number): number {
  const scale = getDecimalScale(decimalPlaces);
  return Math.round(value * scale) / scale;
}

/** 小数問題で範囲未指定のときに使う、0から99までの整数単位範囲を返します。 */
export function getDefaultDecimalUnitRange(decimalPlaces: number): NumberRange {
  return { min: 0, max: 99 * getDecimalScale(decimalPlaces) };
}

/** 問題内の指定スロットが何けた小数で表示されるかを返します。 */
export function getProblemDecimalPlaces(problem: MathProblem, slot: 'left' | 'right' | 'result'): number {
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
export function getAnswerSlot(rule: ConfigurableProblemRule): ProblemAnswerSlot | null {
  if (rule.answerSlot) {
    return rule.answerSlot;
  }

  const slots: Array<readonly [ProblemAnswerSlot, ProblemNumberRange | undefined]> = [
    ['left', rule.left],
    ['right', rule.right],
    ['result', rule.result],
    ['leftDenominator', rule.leftDenominator],
    ['rightDenominator', rule.rightDenominator],
    ['resultDenominator', rule.resultDenominator],
  ];
  const blankSlots = slots.filter(([, range]) => Array.isArray(range) && range.length === 0);

  if (blankSlots.length > 1) {
    return null;
  }

  return blankSlots.length === 1
    ? blankSlots[0][0]
    : 'result';
}

/** 演算子と左右の数から計算結果を求めます。割る数が0なら無効値にします。 */
export function calculateResult(operator: ProblemOperator, left: number, right: number): number {
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
export function matchesDigitRule(
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
export function matchesRemainderRule(remainderRule: ProblemRemainderRule | undefined, remainder: number): boolean {
  if (!remainderRule || remainderRule === 'any') {
    return true;
  }

  if (remainderRule === 'none') {
    return remainder === 0;
  }

  return remainder > 0;
}

/** 空欄位置に応じて、その問題の正しい答えになる値を取り出します。 */
export function getAnswerValue(problem: Omit<MathProblem, 'answer'>): number {
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
export function isAnswerInInputRange(answer: number): boolean {
  return answer >= ANSWER_MIN && answer <= ANSWER_MAX;
}

/** 範囲未指定のループには、標準の0から99の範囲を使います。 */
export function toLoopRange(range: NumberRange | null): NumberRange {
  return range ?? DEFAULT_OPERAND_RANGE;
}

/** 時計の時刻を、分が0なら時だけ、それ以外は時分の数値へ符号化します。 */
export function encodeClockAnswer(hour: number, minute: number): number {
  return minute === 0 ? hour : hour * 100 + minute;
}

/** 時計問題の時刻を、問題文や答え表示で読める文字列にします。 */
export function formatClockTime(hour: number, minute: number): string {
  return minute === 0 ? `${hour}時` : `${hour}時${minute}分`;
}

/** Converts 0-719 clock minutes into a 12-hour clock hour. */
export function getClockHourFromTotalMinutes(totalMinutes: number): number {
  const hour = Math.floor((((totalMinutes % 720) + 720) % 720) / 60);
  return hour === 0 ? 12 : hour;
}

/** Converts total clock minutes into the minute shown on a clock. */
export function getClockMinuteFromTotalMinutes(totalMinutes: number): number {
  return ((totalMinutes % 60) + 60) % 60;
}

/** Checks whether two clock minute totals are in the same hour block. */
export function isSameClockHourBlock(startMinutes: number, endMinutes: number): boolean {
  return Math.floor(startMinutes / 60) === Math.floor(endMinutes / 60);
}

/** √の中の数を、外に出せる係数と残る数に分けます。 */
export function getSquareRootParts(value: number): { coefficient: number; radicand: number } | null {
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

/** ループ用の範囲を取得し、未指定なら渡された既定範囲を使います。 */
export function getLoopRangeOrFallback(range: ProblemNumberRange | undefined, fallback: NumberRange): NumberRange {
  return normalizeRange(range ?? null) ?? fallback;
}

/** 表示上の係数と根号内数から、整理後の√項情報を作ります。 */
export function getSquareRootTerm(displayCoefficient: number, displayRadicand: number): SquareRootTerm | null {
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

/** 大小比較用の項から、画面やログで使う表示文字列を作ります。 */
export function formatSquareRootComparisonTerm(term: SquareRootComparisonTerm): string {
  const sign = term.sign < 0 ? '-' : '';
  return term.kind === 'root' ? `${sign}√${term.value}` : `${sign}${term.value}`;
}
