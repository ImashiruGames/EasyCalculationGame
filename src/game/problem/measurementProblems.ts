import type { ConfigurableProblemRule, MathProblem, MeasurementProblemDisplay } from '../types';
import { randomBetween } from './problemNumbers';

/** Writes a length with a single mm digit, including zero when needed. */
function mixedLength(mm: number): string {
  return `${Math.floor(mm / 10)}cm ${mm % 10}mm`;
}

/** Creates a length question with display text and either one or two answer fields. */
function lengthProblem(
  total: number,
  display: MeasurementProblemDisplay,
  pair = false,
): MathProblem {
  return {
    kind: 'measurement', left: total, right: 0, operator: '=', result: total,
    answer: pair ? Math.floor(total / 10) : total,
    remainder: pair ? total % 10 : undefined,
    answerSlot: 'result', answerMode: pair ? 'measurementPair' : 'single',
    measurement: display,
  };
}

/** Generates the seven length steps, using whole millimetres for all calculations. */
export function createMeasurementProblem(rule: ConfigurableProblemRule): MathProblem {
  const mode = rule.measurementMode ?? 'reading';
  if (mode === 'reading') {
    const index = randomBetween(0, 1);
    const labels = ['センチメートル', 'ミリメートル'];
    const problem = lengthProblem(index, {
      prompt: '読み方を えらぼう', expression: index === 0 ? 'cm' : 'mm',
      answerUnits: [], answerLabel: labels[index],
      choices: labels.map((label, value) => ({ label, value })),
    });
    problem.answerMode = 'choiceGrid';
    return problem;
  }

  if (mode === 'compare') {
    const cm = randomBetween(1, 9);
    // Use values on both sides of the cm length, and never offer equal lengths.
    const offset = randomBetween(1, 9) * (randomBetween(0, 1) === 0 ? -1 : 1);
    const mm = cm * 10 + offset;
    const labels = [`${cm}cm`, `${mm}mm`];
    const correct = cm * 10 > mm ? 0 : 1;
    const problem = lengthProblem(correct, {
      prompt: '大きいのは どっち？', expression: '', answerUnits: [],
      answerLabel: labels[correct], choices: labels.map((label, value) => ({ label, value })),
    });
    problem.answerMode = 'choiceGrid';
    return problem;
  }

  if (mode === 'convert' || mode === 'mixedConvert') {
    const cm = randomBetween(1, 9);
    const mm = mode === 'mixedConvert' ? randomBetween(1, 9) : 0;
    const total = cm * 10 + mm;
    const toSmall = randomBetween(0, 1) === 0;
    const pair = !toSmall && mode === 'mixedConvert';
    const value = toSmall || pair ? total : cm;
    return lengthProblem(value, {
      prompt: '□に 数を 入れよう',
      expression: toSmall ? `${mm === 0 ? `${cm}cm` : mixedLength(total)} =` : `${total}mm =`,
      answerUnits: pair ? ['cm', 'mm'] : [toSmall ? 'mm' : 'cm'],
      answerLabel: pair ? mixedLength(total) : `${value}${toSmall ? 'mm' : 'cm'}`,
      hint: pair ? '0のときも 0を 入れてね' : undefined,
    }, pair);
  }

  const subtract = rule.operator === '-' || rule.operator === 'minus';
  let left: number;
  let right: number;
  let leftLabel: string;
  let rightLabel: string;
  if (mode === 'sameArithmetic') {
    const cmOnly = randomBetween(0, 1) === 0;
    const factor = cmOnly ? 10 : 1;
    left = randomBetween(1, 9) * factor;
    right = randomBetween(1, 9) * factor;
    leftLabel = `${left / factor}${cmOnly ? 'cm' : 'mm'}`;
    rightLabel = `${right / factor}${cmOnly ? 'cm' : 'mm'}`;
  } else {
    left = randomBetween(1, 9) * 10 + randomBetween(1, 9);
    leftLabel = mixedLength(left);
    const bothMixed = mode === 'mixedArithmetic' && randomBetween(0, 2) !== 0;
    const cmOnly = randomBetween(0, 1) === 0;
    right = bothMixed
      ? randomBetween(1, 9) * 10 + randomBetween(1, 9)
      : randomBetween(1, 9) * (cmOnly ? 10 : 1);
    rightLabel = bothMixed ? mixedLength(right) : `${right / (cmOnly ? 10 : 1)}${cmOnly ? 'cm' : 'mm'}`;
  }
  if (subtract && left < right) {
    [left, right] = [right, left];
    [leftLabel, rightLabel] = [rightLabel, leftLabel];
  }
  const total = subtract ? left - right : left + right;
  const problem = lengthProblem(total, {
    prompt: '計算しよう', expression: `${leftLabel} ${subtract ? '−' : '＋'} ${rightLabel} =`,
    answerUnits: ['cm', 'mm'], answerLabel: mixedLength(total),
    hint: 'mmのくらいは 一けたで 書いてね\n0のときも 0を 入れてね',
  }, true);
  problem.left = left;
  problem.right = right;
  problem.operator = subtract ? '-' : '+';
  return problem;
}
