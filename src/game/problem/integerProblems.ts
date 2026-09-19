import { getStageGridExpressionProblem, getStageGridExpressionProblems } from '../../data/stageProblems';
import { ConfigurableProblemRule, MathProblem, ProblemHiddenDigitSlot } from '../types';
import { clampRange } from './fractionProblems';
import {
  calculateResult,
  containsRange,
  decimalUnitToValue,
  getAnswerSlot,
  getAnswerValue,
  getChoiceAnswerMode,
  getDecimalScale,
  getDefaultDecimalUnitRange,
  isAnswerInInputRange,
  matchesDigitRule,
  matchesRemainderRule,
  normalizeDecimalPlaces,
  normalizeDecimalRange,
  normalizeOperator,
  normalizeRange,
  randomBetween,
  toLoopRange,
} from './problemNumbers';

const MISSING_DIGIT_SLOTS: ProblemHiddenDigitSlot[] = [
  'leftTens',
  'leftOnes',
  'rightTens',
  'rightOnes',
  'resultTens',
  'resultOnes',
];

/** 小数の加減問題をルールから1問作り、まずランダムに探してから全探索で補います。 */
export function createDecimalProblemFromConfig(rule: ConfigurableProblemRule): MathProblem | null {
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
export function collectIntegerProblemCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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
export function collectShapeAreaCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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

/** Builds hand-authored grid expression problems from stage problem JSON. */
export function collectGridExpressionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const stageId = rule.stageProblemStageId;
  if (!stageId) {
    return [];
  }

  const problems = typeof rule.stageProblemNo === 'number'
    ? [getStageGridExpressionProblem(stageId, rule.stageProblemNo)]
      .filter((problem): problem is NonNullable<typeof problem> => Boolean(problem))
    : getStageGridExpressionProblems(stageId);

  return problems
    .filter((problem) => isAnswerInInputRange(problem.answer))
    .map((problem) => ({
      kind: 'gridExpression' as const,
      left: 0,
      operator: '=' as const,
      right: 0,
      result: problem.answer,
      answer: problem.answer,
      answerSlot: 'result' as const,
      gridExpression: problem,
    }));
}

/** Builds arithmetic problems that are displayed as vertical calculations. */
export function collectVerticalArithmeticCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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
export function collectMissingDigitArithmeticCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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
export function collectIntegerDivisionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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
