import {
  MathProblem,
  ProblemHiddenDigitSlot,
  SquareRootComparisonTerm,
  SquareRootProblemMode,
} from '../types';

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

/** Checks whether the problem asks elapsed minutes between two clocks. */
export function isClockElapsedMinutesProblem(
  problem: MathProblem,
): problem is MathProblem & { kind: 'clockElapsedMinutes' } {
  return problem.kind === 'clockElapsedMinutes';
}

/** Checks whether elapsed clock problems ask for the ending time. */
export function usesClockElapsedTimeAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'clockElapsedMinutes'; answerMode: 'clockHourMinute' } {
  return isClockElapsedMinutesProblem(problem) && problem.answerMode === 'clockHourMinute';
}

/** Checks whether elapsed clock problems ask for elapsed hours. */
export function usesClockElapsedHoursAnswer(
  problem: MathProblem,
): problem is MathProblem & { kind: 'clockElapsedMinutes'; answerMode: 'clockElapsedHours' } {
  return isClockElapsedMinutesProblem(problem) && problem.answerMode === 'clockElapsedHours';
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

/** Checks whether the problem uses a hand-authored grid picture. */
export function isGridExpressionProblem(
  problem: MathProblem,
): problem is MathProblem & { kind: 'gridExpression'; gridExpression: NonNullable<MathProblem['gridExpression']> } {
  return problem.kind === 'gridExpression' && Boolean(problem.gridExpression);
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

/** Narrows division problems to those with a numeric remainder. */
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
  return problem.answerMode === 'measurementPair'
    || usesQuotientRemainderAnswer(problem)
    || usesClockElapsedTimeAnswer(problem)
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
