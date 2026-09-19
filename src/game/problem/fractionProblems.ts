import { ConfigurableProblemRule, MathProblem } from '../types';
import {
  DEFAULT_FRACTION_DENOMINATOR_RANGE,
  NumberRange,
  containsRange,
  getAnswerSlot,
  getAnswerValue,
  getGreatestCommonDivisor,
  getLeastCommonMultiple,
  isAnswerInInputRange,
  normalizeOperator,
  normalizeRange,
} from './problemNumbers';

/** 範囲を指定された下限・上限内へ切り詰め、空になる場合はnullにします。 */
export function clampRange(range: NumberRange, min: number, max: number): NumberRange | null {
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
export function collectSameDenominatorFractionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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
export function collectEquivalentFractionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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
export function collectDifferentDenominatorFractionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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
export function collectFractionProductQuotientCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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
