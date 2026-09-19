import {
  ConfigurableProblemRule,
  MathProblem,
  ProblemAnswerSlot,
  ProblemOperatorInput,
  SquareRootComparisonTerm,
  SquareRootProblemMode,
} from '../types';
import {
  containsRange,
  DEFAULT_SQUARE_ROOT_DECIMAL_PLACES,
  getAnswerSlot,
  getAnswerValue,
  getDecimalScale,
  getGreatestCommonDivisor,
  getLoopRangeOrFallback,
  getSquareRootParts,
  getSquareRootTerm,
  isAnswerInInputRange,
  normalizeDecimalPlaces,
  normalizeDecimalRange,
  normalizeOperator,
  normalizeRange,
  roundToDecimalPlaces,
  SquareRootTerm,
  toLoopRange,
} from './problemNumbers';

type SquareRootExpressionMode =
  | 'addLike'
  | 'minusLike'
  | 'addSimplifyLike'
  | 'minusSimplifyLike';

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

/** √の中に平方因子が残っていない、整理済みの根号内数かを判定します。 */
function isSquareFreeRootRadicand(value: number): boolean {
  const parts = getSquareRootParts(value);
  return !!parts && parts.coefficient === 1 && parts.radicand === value && value > 1;
}

/** 大小比較用の項を、実際に比べる数値へ変換します。 */
function getSquareRootComparisonTermValue(term: SquareRootComparisonTerm): number {
  const baseValue = term.kind === 'root' ? Math.sqrt(term.value) : term.value;
  return term.sign * baseValue;
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
export function collectSquareRootCandidates(rule: ConfigurableProblemRule): MathProblem[] {
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
