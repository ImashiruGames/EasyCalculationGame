import { MathProblem, ProblemHiddenDigitSlot } from '../types';
import {
  isClockElapsedMinutesProblem,
  isClockMinuteConversionProblem,
  isClockTimeProblem,
  isDecimalProblem,
  isDifferentDenominatorFractionProblem,
  isEquivalentFractionProblem,
  isFractionProductQuotientProblem,
  isGridExpressionProblem,
  isIntegerDivisionProblem,
  isMissingDigitArithmeticProblem,
  isSameDenominatorFractionProblem,
  isShapeAreaProblem,
  isSquareRootProblem,
  isVerticalArithmeticProblem,
  usesClockElapsedHoursAnswer,
  usesClockElapsedTimeAnswer,
  usesClockMinuteConversionPairAnswer,
  usesQuotientRemainderAnswer,
  usesSquareRootComparisonAnswer,
  usesSquareRootDecimalValueAnswer,
  usesSquareRootExpressionAnswer,
  usesSquareRootFractionAnswer,
  usesSquareRootPairAnswer,
  usesSquareRootRationalizeAnswer,
  usesSquareRootSimplifyAnswer,
} from './problemKinds';
import {
  formatClockTime,
  formatSquareRootComparisonTerm,
  getClockHourFromTotalMinutes,
  getClockMinuteFromTotalMinutes,
  getProblemAnswerDecimalPlaces,
  getProblemDecimalPlaces,
} from './problemNumbers';

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
  if (problem.measurement) {
    const display = problem.measurement;
    const choices = display.choices?.map((choice) => choice.label).join(' / ');
    return `${display.prompt}\n${display.expression}${choices ?? display.answerUnits.map((unit) => `□${unit}`).join(' ')}`;
  }
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

  if (isClockElapsedMinutesProblem(problem)) {
    const startTime = formatClockTime(
      getClockHourFromTotalMinutes(problem.left),
      getClockMinuteFromTotalMinutes(problem.left),
    );
    const endTime = formatClockTime(
      getClockHourFromTotalMinutes(problem.right),
      getClockMinuteFromTotalMinutes(problem.right),
    );
    if (usesClockElapsedTimeAnswer(problem)) {
      return problem.clockDisplayMode === 'text'
        ? `${startTime}から ${problem.result}分後\n時こくは □時□分`
        : `時計 ${startTime}から ${problem.result}分後\n時こくは □時□分`;
    }
    if (usesClockElapsedHoursAnswer(problem)) {
      return problem.clockDisplayMode === 'text'
        ? `${startTime}から ${endTime}\n時間は □時間`
        : `時計 ${startTime} → 時計 ${endTime}\n時間は □時間`;
    }
    if (problem.clockDisplayMode === 'text') {
      return `${startTime}から ${endTime}\n時間は □分`;
    }
    return `時計 ${startTime} → 時計 ${endTime}\n時間は □分`;
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

  if (isGridExpressionProblem(problem)) {
    return `${problem.gridExpression.title ?? '絵を見て しきをつくろう'}\n${problem.gridExpression.expression}`;
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
  if (problem.measurement) {
    return problem.measurement.answerLabel;
  }
  if (isClockTimeProblem(problem)) {
    return formatClockTime(problem.left, problem.right);
  }

  if (isClockElapsedMinutesProblem(problem)) {
    if (usesClockElapsedTimeAnswer(problem)) {
      return formatClockTime(
        getClockHourFromTotalMinutes(problem.right),
        getClockMinuteFromTotalMinutes(problem.right),
      );
    }
    if (usesClockElapsedHoursAnswer(problem)) {
      return `${problem.result}時間`;
    }

    return `${problem.result}分`;
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
