import { ConfigurableProblemRule, MathProblem, ProblemRule, ProblemRuleDefinition } from '../types';
import {
  collectClockElapsedMinutesCandidates,
  collectClockMinuteConversionCandidates,
  collectClockTimeCandidates,
} from './clockProblems';
import {
  collectDifferentDenominatorFractionCandidates,
  collectEquivalentFractionCandidates,
  collectFractionProductQuotientCandidates,
  collectSameDenominatorFractionCandidates,
} from './fractionProblems';
import {
  collectGridExpressionCandidates,
  collectIntegerDivisionCandidates,
  collectIntegerProblemCandidates,
  collectMissingDigitArithmeticCandidates,
  collectShapeAreaCandidates,
  collectVerticalArithmeticCandidates,
  createDecimalProblemFromConfig,
} from './integerProblems';
import { pickRandom, randomBetween } from './problemNumbers';
import { collectSquareRootCandidates } from './squareRootProblems';
import { createMeasurementProblem } from './measurementProblems';

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

/** 問題の種類を見て、専用の候補生成関数へ振り分けます。 */
function collectProblemCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  if (rule.kind === 'clockTime') {
    return collectClockTimeCandidates(rule);
  }

  if (rule.kind === 'clockElapsedMinutes') {
    return collectClockElapsedMinutesCandidates(rule);
  }

  if (rule.kind === 'clockMinuteConversion') {
    return collectClockMinuteConversionCandidates(rule);
  }

  if (rule.kind === 'shapeArea') {
    return collectShapeAreaCandidates(rule);
  }

  if (rule.kind === 'gridExpression') {
    return collectGridExpressionCandidates(rule);
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
  if (rule.kind === 'measurement') {
    return createMeasurementProblem(rule);
  }
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
    JSON.stringify(problem.measurement ?? ''),
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
    problem.gridExpression?.id ?? '',
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
