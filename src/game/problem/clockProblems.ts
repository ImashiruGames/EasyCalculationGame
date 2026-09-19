import { ConfigurableProblemRule, MathProblem } from '../types';
import { clampRange } from './fractionProblems';
import {
  DEFAULT_CLOCK_HOUR_RANGE,
  DEFAULT_CLOCK_MINUTE_RANGE,
  containsRange,
  encodeClockAnswer,
  getAnswerSlot,
  getAnswerValue,
  getClockHourFromTotalMinutes,
  getClockMinuteFromTotalMinutes,
  isAnswerInInputRange,
  isSameClockHourBlock,
  normalizeOperator,
  normalizeRange,
} from './problemNumbers';

/** 時計を読む問題の候補を、時・分・答え範囲から全件作ります。 */
export function collectClockTimeCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || (answerSlot !== 'left' && answerSlot !== 'right' && answerSlot !== 'result')) {
    return [];
  }

  const hourRange = clampRange(normalizeRange(rule.left) ?? DEFAULT_CLOCK_HOUR_RANGE, 1, 12);
  const minuteRange = clampRange(normalizeRange(rule.right) ?? DEFAULT_CLOCK_MINUTE_RANGE, 0, 59);
  const resultRange = normalizeRange(rule.result);
  const minuteStep = Math.max(1, Math.min(60, Math.floor(rule.minuteStep ?? 1)));
  const candidates: MathProblem[] = [];
  if (!hourRange || !minuteRange) {
    return candidates;
  }

  for (let hour = hourRange.min; hour <= hourRange.max; hour += 1) {
    for (let minute = minuteRange.min; minute <= minuteRange.max; minute += 1) {
      if (minute % minuteStep !== 0) {
        continue;
      }

      const result = encodeClockAnswer(hour, minute);
      if (!containsRange(resultRange, result)) {
        continue;
      }

      const problemWithoutAnswer = {
        kind: 'clockTime' as const,
        left: hour,
        operator: '=' as const,
        right: minute,
        result,
        answerSlot,
        minuteStep,
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

/** Collects clock-to-clock elapsed minute problems. */
export function collectClockElapsedMinutesCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || answerSlot !== 'result' || operator !== '=') {
    return [];
  }

  const usesElapsedHoursAnswer = rule.answerMode === 'clockElapsedHours';
  const startRange = clampRange(normalizeRange(rule.left) ?? { min: 0, max: 719 }, 0, 719);
  const elapsedRange = clampRange(normalizeRange(rule.right) ?? { min: 5, max: 60 }, 1, usesElapsedHoursAnswer ? 240 : 99);
  const resultRange = normalizeRange(rule.result);
  const minuteStep = Math.max(1, Math.min(60, Math.floor(rule.minuteStep ?? 5)));
  const startMinuteStep = Math.max(1, Math.min(60, Math.floor(rule.clockStartMinuteStep ?? minuteStep)));
  const clockRangeMode = rule.clockRangeMode ?? 'any';
  const candidates: MathProblem[] = [];
  if (!startRange || !elapsedRange) {
    return candidates;
  }

  for (let startMinutes = startRange.min; startMinutes <= startRange.max; startMinutes += 1) {
    const startMinute = getClockMinuteFromTotalMinutes(startMinutes);
    if (startMinute % startMinuteStep !== 0) {
      continue;
    }

    for (let elapsedMinutes = elapsedRange.min; elapsedMinutes <= elapsedRange.max; elapsedMinutes += 1) {
      if (usesElapsedHoursAnswer && elapsedMinutes % 60 !== 0) {
        continue;
      }

      const elapsedResult = usesElapsedHoursAnswer ? elapsedMinutes / 60 : elapsedMinutes;
      if (elapsedMinutes % minuteStep !== 0 || !containsRange(resultRange, elapsedResult)) {
        continue;
      }

      const endMinutes = (startMinutes + elapsedMinutes) % 720;
      if (clockRangeMode === 'sameHour' && !isSameClockHourBlock(startMinutes, endMinutes)) {
        continue;
      }

      const problemWithoutAnswer = {
        kind: 'clockElapsedMinutes' as const,
        left: startMinutes,
        operator: '=' as const,
        right: endMinutes,
        result: elapsedResult,
        answerSlot,
        minuteStep,
        ...(rule.answerMode ? { answerMode: rule.answerMode } : {}),
        ...(rule.clockStartMinuteStep ? { clockStartMinuteStep: startMinuteStep } : {}),
        ...(rule.clockDisplayMode ? { clockDisplayMode: rule.clockDisplayMode } : {}),
        ...(rule.clockRangeMode ? { clockRangeMode } : {}),
      };
      const answer = rule.answerMode === 'clockHourMinute'
        ? encodeClockAnswer(getClockHourFromTotalMinutes(endMinutes), getClockMinuteFromTotalMinutes(endMinutes))
        : getAnswerValue(problemWithoutAnswer);
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

/** 分を時間と分へ直す問題の候補を、単独答えと二枠答えの両方に対応して作ります。 */
export function collectClockMinuteConversionCandidates(rule: ConfigurableProblemRule): MathProblem[] {
  const operator = normalizeOperator(rule.operator);
  const answerSlot = getAnswerSlot(rule);
  if (!answerSlot || answerSlot !== 'result' || (operator !== '=' && operator !== '×')) {
    return [];
  }

  const sourceLeftRange = normalizeRange(rule.left);
  const sourceRightRange = normalizeRange(rule.right);
  const usesLegacyTimesRange = operator === '×'
    && sourceLeftRange !== null
    && sourceRightRange !== null
    && sourceRightRange.min === sourceRightRange.max;
  const totalMinuteRange = usesLegacyTimesRange
    ? {
        min: sourceLeftRange.min * sourceRightRange.min,
        max: sourceLeftRange.max * sourceRightRange.max,
      }
    : sourceLeftRange ?? { min: 60, max: 110 };
  const hourRange = usesLegacyTimesRange ? null : sourceRightRange;
  const resultRange = normalizeRange(rule.result);
  const minuteStep = Math.max(1, Math.min(60, Math.floor(rule.minuteStep ?? 10)));
  const usesPairAnswer = rule.answerMode === 'clockHourMinute';
  const candidates: MathProblem[] = [];

  for (let totalMinutes = totalMinuteRange.min; totalMinutes <= totalMinuteRange.max; totalMinutes += 1) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    if (totalMinutes < 60 || hour < 1 || minute % minuteStep !== 0) {
      continue;
    }
    if (!containsRange(hourRange, hour) || !containsRange(resultRange, minute)) {
      continue;
    }

    const problemWithoutAnswer = {
      kind: 'clockMinuteConversion' as const,
      left: totalMinutes,
      operator: '=' as const,
      right: hour,
      result: minute,
      ...(usesPairAnswer ? { remainder: minute, answerMode: rule.answerMode } : {}),
      answerSlot,
      minuteStep,
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
