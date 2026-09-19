import { MathProblem } from '../types';
import {
  isClockTimeProblem,
  isDecimalProblem,
  usesClockElapsedTimeAnswer,
  usesClockMinuteConversionPairAnswer,
  usesMultiSelectChoiceAnswer,
  usesQuotientRemainderAnswer,
  usesSquareRootDecimalValueAnswer,
  usesSquareRootExpressionAnswer,
  usesSquareRootFractionAnswer,
  usesSquareRootPairAnswer,
  usesSquareRootRationalizeAnswer,
  usesSquareRootSimplifyAnswer,
  usesTwoPartAnswer,
} from './problemKinds';
import {
  getClockHourFromTotalMinutes,
  getClockMinuteFromTotalMinutes,
  getDecimalScale,
  getProblemAnswerDecimalPlaces,
  getSquareRootTerm,
} from './problemNumbers';

export type ProblemAnswerPairJudgement = 'correct' | 'partial' | 'wrong';

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
  if (problem.answerMode === 'measurementPair') {
    return quotient === problem.answer && remainder === problem.remainder ? 'correct' : 'wrong';
  }
  if (usesQuotientRemainderAnswer(problem)) {
    return quotient === problem.result && remainder === problem.remainder ? 'correct' : 'wrong';
  }

  if (usesClockMinuteConversionPairAnswer(problem)) {
    return quotient === problem.right && remainder === problem.result ? 'correct' : 'wrong';
  }

  if (usesClockElapsedTimeAnswer(problem)) {
    return quotient === getClockHourFromTotalMinutes(problem.right)
      && remainder === getClockMinuteFromTotalMinutes(problem.right)
      ? 'correct'
      : 'wrong';
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
