import type { MathProblem } from '../types';
import {
  isClockTimeProblem,
  isDecimalProblem,
  isMissingDigitArithmeticProblem,
  isVerticalArithmeticProblem,
  usesChoiceAnswer,
  usesSquareRootDecimalValueAnswer,
} from './problemKinds';

/** Uses right-to-left digit entry for the result row of written arithmetic. */
export function usesPlaceValueAnswer(problem: MathProblem): boolean {
  return isVerticalArithmeticProblem(problem) && problem.answerSlot === 'result' && !usesChoiceAnswer(problem);
}

/** 今の問題で、小数入力が必要な場合の答えの小数けた数を返します。 */
export function getCaptureAnswerDecimalPlaces(problem: MathProblem): number {
  if (usesSquareRootDecimalValueAnswer(problem)) {
    return problem.resultDecimalPlaces ?? 3;
  }

  if (!isDecimalProblem(problem)) {
    return 0;
  }

  if (problem.answerSlot === 'left') {
    return problem.leftDecimalPlaces ?? 0;
  }
  if (problem.answerSlot === 'right') {
    return problem.rightDecimalPlaces ?? 0;
  }

  return problem.resultDecimalPlaces ?? 0;
}

/** Returns how many typed characters the current single answer needs. */
export function getCaptureAnswerMaxDigits(problem: MathProblem, answerDecimalPlaces = 0): number {
  if (answerDecimalPlaces > 0) {
    return 5 + answerDecimalPlaces;
  }

  if (isMissingDigitArithmeticProblem(problem)) {
    return 1;
  }

  if (
    isClockTimeProblem(problem)
    && problem.answerSlot === 'result'
    && problem.right !== 0
  ) {
    return 4;
  }

  const wholeNumberAnswer = Math.abs(Math.trunc(problem.answer));
  return Math.min(4, Math.max(2, String(wholeNumberAnswer).length));
}
