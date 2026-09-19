import type { MathProblem } from '../types';
import { isProblemAnswerCorrect, usesMultiSelectChoiceAnswer } from './mathProblems';

export interface ChoiceAnswerOption {
  id: string;
  label: string;
  value: number;
  isCorrect: boolean;
}

interface ChoiceExpression {
  label: string;
  value: number;
}

/** Builds numeric and expression options without depending on a Phaser scene. */
export class ChoiceAnswerGenerator {
  /** Keeps the current question and receives the game's existing shuffle implementation. */
  constructor(
    private readonly problem: MathProblem,
    private readonly decimalPlaces: number,
    private readonly shuffle: <T>(items: T[]) => T[],
  ) {}

  /** 今のanswerModeに合わせて、数字カード・式カード・全て選べカードを作り分けます。 */
  createOptions(): ChoiceAnswerOption[] {
    if (this.problem.measurement?.choices) {
      return this.shuffleItems(this.problem.measurement.choices).map((choice, index) => ({
        ...choice, id: `choice-${index}`, isCorrect: choice.value === this.problem.answer,
      }));
    }
    if (usesMultiSelectChoiceAnswer(this.problem)) {
      return this.createMultiSelectChoiceOptions();
    }

    if (this.problem.answerMode === 'choiceColumn') {
      return this.createExpressionSingleChoiceOptions();
    }

    return this.createSingleChoiceOptions();
  }

  /** 4択用に、正解1つと近い数字の不正解3つを候補へ整えます。 */
  private createSingleChoiceOptions(): ChoiceAnswerOption[] {
    const values = this.shuffleItems(this.createNumericChoiceValues(this.problem.answer, 4));
    return values.map((value, index) => ({
      id: `choice-${index}`,
      label: this.formatChoiceValue(value),
      value,
      isCorrect: isProblemAnswerCorrect(this.problem, value),
    }));
  }

  /** 式を選ぶ4択用に、同じ答えになる式1つと違う答えの式3つを候補へ整えます。 */
  private createExpressionSingleChoiceOptions(): ChoiceAnswerOption[] {
    const target = Math.max(0, Math.trunc(this.problem.answer));
    const usedLabels = new Set<string>();
    const correctExpression = this.pickExpressionChoicesForValue(target, 1, usedLabels)[0]
      ?? { label: `${target}+0`, value: target };
    const wrongExpressions = this.pickWrongExpressionChoices(target, 3, usedLabels);
    const expressions = this.shuffleItems([
      { ...correctExpression, isCorrect: true },
      ...wrongExpressions.map((expression) => ({ ...expression, isCorrect: false })),
    ]).slice(0, 4);

    return expressions.map((expression, index) => ({
      id: `choice-${index}`,
      label: expression.label,
      value: expression.value,
      isCorrect: expression.isCorrect,
    }));
  }

  /** 全て選べ用に、同じ答えになる式2つと違う答えの式2つを候補へ整えます。 */
  private createMultiSelectChoiceOptions(): ChoiceAnswerOption[] {
    const target = Math.max(0, Math.trunc(this.problem.answer));
    const usedLabels = new Set<string>();
    const correctExpressions = this.pickExpressionChoicesForValue(target, 2, usedLabels);
    const wrongExpressions: ChoiceExpression[] = [];
    const wrongValues = this.createNumericChoiceValues(target, 10)
      .map((value) => Math.trunc(value))
      .filter((value) => value !== target);

    wrongValues.forEach((value) => {
      if (wrongExpressions.length >= 2) {
        return;
      }

      const [expression] = this.pickExpressionChoicesForValue(value, 1, usedLabels);
      if (expression) {
        wrongExpressions.push(expression);
      }
    });

    const expressions = this.shuffleItems([
      ...correctExpressions.map((expression) => ({ ...expression, isCorrect: true })),
      ...wrongExpressions.map((expression) => ({ ...expression, isCorrect: false })),
    ]).slice(0, 4);

    return expressions.map((expression, index) => ({
      id: `choice-${index}`,
      label: expression.label,
      value: expression.value,
      isCorrect: expression.isCorrect,
    }));
  }

  /** 式選択の不正解用に、近い答えと大きめの答えを混ぜながら式候補を集めます。 */
  private pickWrongExpressionChoices(target: number, count: number, usedLabels: Set<string>): ChoiceExpression[] {
    const wrongExpressions: ChoiceExpression[] = [];
    const wrongValues = this.createExpressionWrongValues(target);

    wrongValues.forEach((value) => {
      if (wrongExpressions.length >= count) {
        return;
      }

      const [expression] = this.pickExpressionChoicesForValue(value, 1, usedLabels);
      if (expression) {
        wrongExpressions.push(expression);
      }
    });

    for (let value = 0; wrongExpressions.length < count && value <= 99; value += 1) {
      if (value === target) {
        continue;
      }

      const [expression] = this.pickExpressionChoicesForValue(value, 1, usedLabels);
      if (expression) {
        wrongExpressions.push(expression);
      }
    }

    return wrongExpressions;
  }

  /** 式カードの不正解に使う答え値を、同じ値を避けながら順に作ります。 */
  private createExpressionWrongValues(target: number): number[] {
    const values: number[] = [];
    const addValue = (value: number) => {
      const roundedValue = Math.max(0, Math.trunc(value));
      if (roundedValue === target || values.includes(roundedValue)) {
        return;
      }

      values.push(roundedValue);
    };

    [
      target + 4,
      target + 7,
      target + 34,
      target + 10,
      target + 20,
      target * 2 + 1,
      Math.max(0, target - 1),
    ].forEach(addValue);
    this.createNumericChoiceValues(target, 12).forEach(addValue);

    return values;
  }

  /** 答えの近くにある数字を、重複しない選択肢として必要数だけ作ります。 */
  private createNumericChoiceValues(answer: number, count: number): number[] {
    const values = [this.roundChoiceValue(answer)];
    const step = this.getChoiceValueStep();

    for (let distance = 1; values.length < count && distance < 40; distance += 1) {
      this.addUniqueChoiceValue(values, answer + step * distance);
      this.addUniqueChoiceValue(values, answer - step * distance);
    }

    return values.slice(0, count);
  }

  /** 小数問題でも表示が崩れないよう、候補値を答えの小数けたに丸めます。 */
  private roundChoiceValue(value: number): number {
    const decimalPlaces = this.decimalPlaces;
    const scale = 10 ** decimalPlaces;
    return Math.round(value * scale) / scale;
  }

  /** 選択肢を1ずつずらすか、小数の最小単位でずらすかを返します。 */
  private getChoiceValueStep(): number {
    const decimalPlaces = this.decimalPlaces;
    return decimalPlaces > 0 ? 1 / (10 ** decimalPlaces) : 1;
  }

  /** 数字候補の表示が同じにならない場合だけ、候補配列へ追加します。 */
  private addUniqueChoiceValue(values: number[], value: number): void {
    const roundedValue = this.roundChoiceValue(value);
    if (roundedValue < 0) {
      return;
    }

    const label = this.formatChoiceValue(roundedValue);
    if (values.some((current) => this.formatChoiceValue(current) === label)) {
      return;
    }

    values.push(roundedValue);
  }

  /** 数字候補を、整数または小数けたつきの文字として表示用に整えます。 */
  private formatChoiceValue(value: number): string {
    const decimalPlaces = this.decimalPlaces;
    if (decimalPlaces > 0) {
      return value.toFixed(decimalPlaces);
    }

    return String(value);
  }

  /** 指定した答えになる一けたのたし算・ひき算式を、重複を避けて必要数だけ選びます。 */
  private pickExpressionChoicesForValue(value: number, count: number, usedLabels: Set<string>): ChoiceExpression[] {
    const candidates = this.shuffleItems(this.createExpressionCandidatesForValue(value));
    const picked: ChoiceExpression[] = [];

    candidates.forEach((candidate) => {
      if (picked.length >= count || usedLabels.has(candidate.label)) {
        return;
      }

      usedLabels.add(candidate.label);
      picked.push(candidate);
    });

    return picked;
  }

  /** 一けたと十のまとまりを使い、指定した答えになる式候補をすべて作ります。 */
  private createExpressionCandidatesForValue(value: number): ChoiceExpression[] {
    const candidates: ChoiceExpression[] = [];
    const operands = [...Array.from({ length: 10 }, (_, index) => index), 10, 20, 30, 40, 50, 60, 70, 80, 90];
    operands.forEach((left) => {
      operands.forEach((right) => {
        if (left + right === value && (value === 0 || (left > 0 && right > 0))) {
          candidates.push({ label: `${left}+${right}`, value });
        }
        if (left >= right && left - right === value && (value === 0 || right > 0)) {
          candidates.push({ label: `${left}-${right}`, value });
        }
      });
    });

    return candidates;
  }

  /** 配列の順番をランダムに入れ替え、元配列は変えずに返します。 */
  private shuffleItems<T>(items: T[]): T[] {
    return this.shuffle([...items]);
  }
}
