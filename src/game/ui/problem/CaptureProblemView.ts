import * as Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_WIDTH } from '../../constants';
import { APP_LAYOUT } from '../../layoutConfig';
import { getCaptureAnswerDecimalPlaces, getCaptureAnswerMaxDigits, usesPlaceValueAnswer } from '../../problem/answerInput';
import {
  formatProblem,
  formatSquareRootSquaredBase,
  isClockElapsedMinutesProblem,
  isClockMinuteConversionProblem,
  isClockTimeProblem,
  isDecimalProblem,
  isFractionProblem,
  isGridExpressionProblem,
  isMissingDigitArithmeticProblem,
  isShapeAreaProblem,
  isSquareRootProblem,
  isVerticalArithmeticProblem,
  usesChoiceAnswer,
  usesClockElapsedHoursAnswer,
  usesClockElapsedTimeAnswer,
  usesClockMinuteConversionPairAnswer,
  usesMultiSelectChoiceAnswer,
  usesQuotientRemainderAnswer,
  usesSquareRootComparisonAnswer,
  usesSquareRootDecimalValueAnswer,
  usesSquareRootExpressionAnswer,
  usesSquareRootFractionAnswer,
  usesSquareRootPairAnswer,
  usesSquareRootRationalizeAnswer,
  usesSquareRootSimplifyAnswer,
  usesTwoPartAnswer,
} from '../../problem/mathProblems';
import { MathProblem, SquareRootComparisonTerm } from '../../types';
import { drawGridExpressionGrid } from './gridExpression';

const CAPTURE_LAYOUT = APP_LAYOUT.captureGame;
const FORMULA_HORIZONTAL_PADDING = 12;
const ROOT_RADICAL_CONTENT_OFFSET = 30;

interface AnswerSlotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

type RootEquationPart =
  | {
      kind: 'text';
      width: number;
      text: Phaser.GameObjects.Text;
    }
  | {
      kind: 'slot';
      width: number;
    }
  | {
      kind: 'radical';
      width: number;
      contentWidth: number;
      text: Phaser.GameObjects.Text | null;
      hasSlot: boolean;
    };

type FractionEquationPart =
  | {
      kind: 'fraction';
      width: number;
      slot: 'numerator' | 'denominator' | null;
      numeratorText: Phaser.GameObjects.Text | null;
      denominatorText: Phaser.GameObjects.Text | null;
    }
  | {
      kind: 'text';
      width: number;
      text: Phaser.GameObjects.Text;
    };

export interface CaptureAnswerDisplayState {
  first: string;
  second: string;
  activePart: 'quotient' | 'remainder';
  selectedChoiceLabel?: string;
}

/** Owns question layout and answer visuals; the scene owns gameplay and input state. */
export class CaptureProblemView {
  private problem: MathProblem;
  private input: CaptureAnswerDisplayState;

  readonly equationContainer: Phaser.GameObjects.Container;
  private readonly answerBox: Phaser.GameObjects.Graphics;
  private readonly activeAnswerBox: Phaser.GameObjects.Graphics;
  readonly answerText: Phaser.GameObjects.Text;
  public remainderAnswerText?: Phaser.GameObjects.Text;
  private quotientAnswerBounds: AnswerSlotBounds | null = null;
  private remainderAnswerBounds: AnswerSlotBounds | null = null;
  private placeValueDigits: Phaser.GameObjects.Text[] = [];
  private placeValueSlots: AnswerSlotBounds[] = [];
  public gridProblemLayer?: Phaser.GameObjects.Container;
  public gridProblemAnswerText?: Phaser.GameObjects.Text;

  /** Creates the same display objects in the same order as the original scene. */
  constructor(private readonly scene: Phaser.Scene, private readonly accentColor: string) {

    this.answerBox = this.scene.add.graphics();
    this.activeAnswerBox = this.scene.add.graphics();
    this.equationContainer = this.scene.add.container(0, 0);

    this.answerText = this.scene.add
      .text(CAPTURE_LAYOUT.answerText.x, CAPTURE_LAYOUT.answerText.y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '34px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

  }

  /** 問題の種類を見て、専用の式レイアウト描画関数へ振り分けます。 */
  render(problem: MathProblem, input: CaptureAnswerDisplayState): void {
    this.problem = problem;
    this.input = input;
    this.clearGridProblemLayer();
    this.placeValueDigits = [];
    this.placeValueSlots = [];
    this.answerText.setVisible(true);

    if (this.problem.measurement) {
      this.renderMeasurementProblem();
      return;
    }

    if (isGridExpressionProblem(this.problem)) {
      this.renderGridExpressionProblem();
      return;
    }

    if (this.problem.answerMode === 'choiceColumn') {
      this.renderChoiceColumnProblem();
      return;
    }

    if (usesMultiSelectChoiceAnswer(this.problem)) {
      this.renderMultiSelectProblem();
      return;
    }

    if (usesQuotientRemainderAnswer(this.problem)) {
      this.renderDivisionRemainderProblem();
      return;
    }

    if (isSquareRootProblem(this.problem)) {
      this.renderSquareRootProblem();
      return;
    }

    if (isClockMinuteConversionProblem(this.problem)) {
      this.renderClockMinuteConversionProblem();
      return;
    }

    this.clearRemainderAnswerText();

    if (isClockElapsedMinutesProblem(this.problem)) {
      this.renderClockElapsedMinutesProblem();
      return;
    }

    if (isClockTimeProblem(this.problem)) {
      this.renderClockProblem();
      return;
    }

    if (isShapeAreaProblem(this.problem)) {
      this.renderShapeAreaProblem();
      return;
    }

    if (isVerticalArithmeticProblem(this.problem)) {
      this.renderVerticalArithmeticProblem();
      return;
    }

    if (isMissingDigitArithmeticProblem(this.problem)) {
      this.renderTextFormulaProblem();
      return;
    }

    if (isFractionProblem(this.problem)) {
      this.renderFractionProblem();
      return;
    }

    this.renderIntegerProblem();
  }

  /** Draws length prompts, unit labels and independently editable number fields. */
  private renderMeasurementProblem(): void {
    const display = this.problem.measurement!;
    const choice = usesChoiceAnswer(this.problem);
    const pair = this.problem.answerMode === 'measurementPair';
    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.clearRemainderAnswerText();
    this.answerText.setFontSize(30).setVisible(!choice);
    const prompt = this.scene.add.text(GAME_WIDTH / 2, 278, display.prompt, {
      fontFamily: FONT_FAMILY, fontSize: '22px', fontStyle: '900', color: COLORS.ink,
    }).setOrigin(0.5);
    const expression = this.scene.add.text(GAME_WIDTH / 2, choice ? 345 : 323, display.expression, {
      fontFamily: FONT_FAMILY, fontSize: choice ? '38px' : '28px', fontStyle: '900', color: COLORS.ink,
    }).setOrigin(0.5);
    expression.setScale(this.getFormulaFitScale(expression.width));
    this.equationContainer.add([prompt, expression]);
    if (choice) {
      this.updateAnswerText();
      return;
    }
    if (pair) {
      this.ensureRemainderAnswerText();
      this.remainderAnswerText?.setFontSize(30);
    }
    const slotWidth = pair ? 66 : 92;
    const slotHeight = 54;
    const answerY = 384;
    const partWidth = pair ? 132 : 152;
    const startX = (GAME_WIDTH - partWidth * display.answerUnits.length) / 2;
    display.answerUnits.forEach((unit, index) => {
      const x = startX + index * partWidth;
      this.drawAnswerBox(x, answerY, slotWidth, slotHeight);
      if (pair) {
        this.placeTwoPartAnswerSlot(index, x, answerY, slotWidth, slotHeight);
      } else {
        this.answerText.setPosition(x + slotWidth / 2, answerY);
      }
      this.equationContainer.add(this.scene.add.text(x + slotWidth + 6, answerY, unit, {
        fontFamily: FONT_FAMILY, fontSize: '26px', fontStyle: '900', color: COLORS.ink,
      }).setOrigin(0, 0.5));
    });
    if (display.hint) {
      this.equationContainer.add(this.scene.add.text(GAME_WIDTH / 2, 436, display.hint, {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: COLORS.ink, align: 'center',
      }).setOrigin(0.5));
    }
    this.updateAnswerText();
  }

  /** Removes the hand-authored grid card before drawing the next problem. */
  private clearGridProblemLayer(): void {
    this.gridProblemLayer?.destroy(true);
    this.gridProblemLayer = undefined;
    this.gridProblemAnswerText = undefined;
  }

  /** 数字候補を、整数または小数けたつきの文字として表示用に整えます。 */
  private formatChoiceValue(value: number): string {
    const decimalPlaces = getCaptureAnswerDecimalPlaces(this.problem);
    if (decimalPlaces > 0) {
      return value.toFixed(decimalPlaces);
    }

    return String(value);
  }

  /** Draws one hand-authored grid problem in the capture screen problem area. */
  private renderGridExpressionProblem(): void {
    if (!isGridExpressionProblem(this.problem)) {
      return;
    }

    this.clearRemainderAnswerText();
    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.answerText.setText('');
    this.answerText.setColor(COLORS.ink);

    const definition = this.problem.gridExpression;
    const region = CAPTURE_LAYOUT.regions.gridQuestion;
    const layer = this.scene.add.container(0, 0).setDepth(8);
    this.gridProblemLayer = layer;

    const shade = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      region.y + region.height / 2,
      GAME_WIDTH,
      region.height,
      Phaser.Display.Color.HexStringToColor('#f1d7ad').color,
      0.4,
    );
    const panel = this.scene.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor('#fff2d8').color, 0.9);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(this.accentColor).color, 0.92);
    panel.fillRoundedRect(region.x, region.y, region.width, region.height, 20);
    panel.strokeRoundedRect(region.x, region.y, region.width, region.height, 20);
    layer.add([shade, panel]);

    layer.add(this.scene.add
      .text(GAME_WIDTH / 2, 118, definition.title ?? '絵を見て しきをつくろう', {
        fontFamily: FONT_FAMILY,
        fontSize: '19px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5));

    drawGridExpressionGrid(this.scene, layer, definition, { top: 164, maxHeight: 170, monsterSize: 40, labelFontSize: 12 });

    layer.add(this.scene.add
      .text(GAME_WIDTH / 2, region.y + region.height - 66, definition.expression, {
        fontFamily: FONT_FAMILY,
        fontSize: '33px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5));

    this.gridProblemAnswerText = this.scene.add
      .text(GAME_WIDTH / 2, region.y + region.height - 28, 'こたえをいれよう', {
        fontFamily: FONT_FAMILY,
        fontSize: '19px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);
    layer.add(this.gridProblemAnswerText);
  }

  /** Draws the prompt for choosing one expression that matches the shown answer. */
  private renderChoiceColumnProblem(): void {
    const equationY = CAPTURE_LAYOUT.problemFormula.y - 4;
    const prompt = this.scene.add
      .text(GAME_WIDTH / 2, equationY, `こたえが ${this.formatChoiceValue(this.problem.answer)}\nになるものはどれ？`, {
        fontFamily: FONT_FAMILY,
        fontSize: '29px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.clearRemainderAnswerText();
    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.answerText.setText('');
    this.equationContainer.add(prompt);
  }

  /** 全て選べ問題の条件文を表示し、答え欄を使わない見た目に切り替えます。 */
  private renderMultiSelectProblem(): void {
    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const prompt = this.scene.add
      .text(GAME_WIDTH / 2, equationY, `こたえが ${this.formatChoiceValue(this.problem.answer)}\nぜんぶえらぶ`, {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.clearRemainderAnswerText();
    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.answerText.setText('');
    this.equationContainer.add(prompt);
  }

  /** あまりつき割り算を横一列に組み、商とあまりの二つの入力欄を置きます。 */
  private renderDivisionRemainderProblem(): void {
    if (!usesQuotientRemainderAnswer(this.problem)) {
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const slotWidth = 58;
    const slotHeight = 64;
    const textStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '32px',
      fontStyle: '900',
      color: COLORS.ink,
    };
    const parts = [
      String(this.problem.left),
      ' ÷ ',
      String(this.problem.right),
      ' = ',
      null,
      ' あまり ',
      null,
    ];

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.quotientAnswerBounds = null;
    this.remainderAnswerBounds = null;
    this.answerText.setFontSize(30);
    this.ensureRemainderAnswerText();
    this.remainderAnswerText?.setFontSize(30);

    const visibleParts = parts.map((part) => {
      if (part === null) {
        return { kind: 'slot' as const, width: slotWidth };
      }

      const text = this.scene.add.text(0, equationY, part, textStyle).setOrigin(0, 0.5);
      this.equationContainer.add(text);
      return { kind: 'text' as const, width: text.width, text };
    });
    const totalWidth = visibleParts.reduce((sum, part) => sum + part.width, 0);
    const scale = this.getFormulaFitScale(totalWidth);
    const fittedSlotWidth = slotWidth * scale;
    const fittedSlotHeight = slotHeight * scale;
    const fittedTotalWidth = totalWidth * scale;
    const fittedAnswerFontSize = this.getFittedFontSize(30, scale, 20);
    this.answerText.setFontSize(fittedAnswerFontSize);
    this.remainderAnswerText?.setFontSize(fittedAnswerFontSize);
    let cursorX = this.getFormulaStartX(fittedTotalWidth);
    let slotIndex = 0;

    visibleParts.forEach((part) => {
      if (part.kind === 'slot') {
        this.drawAnswerBox(cursorX, equationY, fittedSlotWidth, fittedSlotHeight);
        const bounds = { x: cursorX, y: equationY, width: fittedSlotWidth, height: fittedSlotHeight };
        if (slotIndex === 0) {
          this.quotientAnswerBounds = bounds;
          this.answerText.setPosition(cursorX + fittedSlotWidth / 2, equationY);
        } else {
          this.remainderAnswerBounds = bounds;
          this.remainderAnswerText?.setPosition(cursorX + fittedSlotWidth / 2, equationY);
        }
        slotIndex += 1;
        cursorX += fittedSlotWidth;
        return;
      }

      part.text.setScale(scale);
      part.text.setX(cursorX);
      cursorX += part.width * scale;
    });

    this.updateAnswerText();
  }

  /** 計算式が画面端に触れないよう、左右余白を引いた最大幅を返します。 */
  private getFormulaMaxWidth(): number {
    return CAPTURE_LAYOUT.regions.question.width - FORMULA_HORIZONTAL_PADDING * 2;
  }

  /** 式の合計幅が長いときだけ、全体を収める縮小率を計算します。 */
  private getFormulaFitScale(totalWidth: number): number {
    if (totalWidth <= 0) {
      return 1;
    }

    return Math.min(1, this.getFormulaMaxWidth() / totalWidth);
  }

  /** 縮小後の式を中央寄せしつつ、左余白より左へ出ない開始位置を返します。 */
  private getFormulaStartX(totalWidth: number): number {
    return Math.max(CAPTURE_LAYOUT.regions.question.x + FORMULA_HORIZONTAL_PADDING, (GAME_WIDTH - totalWidth) / 2);
  }

  /** 縮小率に合わせて入力文字も小さくし、読みづらくなりすぎない下限を守ります。 */
  private getFittedFontSize(baseFontSize: number, scale: number, minFontSize: number): number {
    return Math.max(minFontSize, Math.floor(baseFontSize * scale));
  }

  /** √問題を部品ごとに組み、必要なら式全体を縮小して一行に収めます。 */
  private renderSquareRootProblem(): void {
    if (!isSquareRootProblem(this.problem)) {
      return;
    }
    if (usesSquareRootComparisonAnswer(this.problem)) {
      this.renderSquareRootComparisonProblem();
      return;
    }
    if (usesSquareRootFractionAnswer(this.problem)) {
      this.renderSquareRootFractionProblem();
      return;
    }
    if (usesSquareRootRationalizeAnswer(this.problem)) {
      this.renderSquareRootRationalizeProblem();
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const slotWidth = usesSquareRootDecimalValueAnswer(this.problem) ? 104 : 58;
    const slotHeight = 64;
    const textStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: usesSquareRootDecimalValueAnswer(this.problem) ? '26px' : '30px',
      fontStyle: '900',
      color: COLORS.ink,
    };
    const lineGraphics = this.scene.add.graphics();
    let parts: RootEquationPart[];
    if (usesSquareRootPairAnswer(this.problem)) {
      parts = [
        this.createRootInlineText(`${this.problem.left}の平方根=`, equationY, textStyle),
        { kind: 'slot', width: slotWidth },
        this.createRootInlineText('と-', equationY, textStyle),
        { kind: 'slot', width: slotWidth },
      ];
    } else if (usesSquareRootExpressionAnswer(this.problem)) {
      parts = [
        ...this.createRootTermParts(this.problem.left, this.problem.rootLeftRadicand, equationY, slotWidth, textStyle),
        this.createRootInlineText(this.problem.operator, equationY, textStyle),
        ...this.createRootTermParts(this.problem.right, this.problem.rootRightRadicand, equationY, slotWidth, textStyle),
        this.createRootInlineText('=', equationY, textStyle),
        { kind: 'slot', width: slotWidth },
        this.createRootRadicalPart(null, true, equationY, slotWidth, textStyle),
      ];
    } else if (usesSquareRootSimplifyAnswer(this.problem)) {
      parts = [
        this.createRootRadicalPart(String(this.problem.left), false, equationY, slotWidth, textStyle),
        this.createRootInlineText('=', equationY, textStyle),
        { kind: 'slot', width: slotWidth },
        this.createRootRadicalPart(null, true, equationY, slotWidth, textStyle),
      ];
    } else if (usesSquareRootDecimalValueAnswer(this.problem)) {
      parts = [
        this.createRootInlineText(`小数点下${getCaptureAnswerDecimalPlaces(this.problem)}けたまで `, equationY, textStyle),
        this.createRootRadicalPart(String(this.problem.left), false, equationY, slotWidth, textStyle),
        this.createRootInlineText('=', equationY, textStyle),
        { kind: 'slot', width: slotWidth },
      ];
    } else if (this.problem.rootMode === 'absoluteSquare') {
      parts = [
        this.createRootRadicalPart(formatSquareRootSquaredBase(this.problem.left), false, equationY, slotWidth, textStyle),
        this.createRootInlineText('=', equationY, textStyle),
        { kind: 'slot', width: slotWidth },
      ];
    } else {
      parts = [
        this.createRootRadicalPart(String(this.problem.left), false, equationY, slotWidth, textStyle),
        this.createRootInlineText('=', equationY, textStyle),
        { kind: 'slot', width: slotWidth },
      ];
    }

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.quotientAnswerBounds = null;
    this.remainderAnswerBounds = null;
    this.answerText.setFontSize(30);
    if (usesTwoPartAnswer(this.problem)) {
      this.ensureRemainderAnswerText();
      this.remainderAnswerText?.setFontSize(30);
    } else {
      this.clearRemainderAnswerText();
    }
    this.equationContainer.add(lineGraphics);

    parts.forEach((part) => {
      if (part.kind === 'text') {
        this.equationContainer.add(part.text);
      }
      if (part.kind === 'radical' && part.text) {
        this.equationContainer.add(part.text);
      }
    });

    const totalWidth = parts.reduce((sum, part) => sum + part.width, 0);
    const scale = this.getFormulaFitScale(totalWidth);
    const fittedSlotWidth = slotWidth * scale;
    const fittedSlotHeight = slotHeight * scale;
    const fittedAnswerFontSize = this.getFittedFontSize(30, scale, 20);
    const fittedTotalWidth = totalWidth * scale;
    let cursorX = this.getFormulaStartX(fittedTotalWidth);
    let slotIndex = 0;

    this.answerText.setFontSize(fittedAnswerFontSize);
    this.remainderAnswerText?.setFontSize(fittedAnswerFontSize);
    lineGraphics.lineStyle(Math.max(2, 4 * scale), Phaser.Display.Color.HexStringToColor(COLORS.ink).color, 1);
    parts.forEach((part) => {
      if (part.kind === 'text') {
        part.text.setScale(scale);
        part.text.setX(cursorX);
        cursorX += part.width * scale;
        return;
      }

      if (part.kind === 'radical') {
        const fittedPartWidth = part.width * scale;
        const fittedContentWidth = part.contentWidth * scale;
        this.drawRadical(lineGraphics, cursorX, equationY, fittedPartWidth, fittedContentWidth, scale);
        const contentX = cursorX + ROOT_RADICAL_CONTENT_OFFSET * scale;
        if (part.hasSlot) {
          this.drawAnswerBox(contentX, equationY, fittedSlotWidth, fittedSlotHeight);
          this.placeTwoPartAnswerSlot(slotIndex, contentX, equationY, fittedSlotWidth, fittedSlotHeight);
          slotIndex += 1;
        } else {
          part.text?.setScale(scale);
          part.text?.setPosition(contentX + fittedContentWidth / 2, equationY + 3 * scale);
        }
        cursorX += fittedPartWidth;
        return;
      }

      this.drawAnswerBox(cursorX, equationY, fittedSlotWidth, fittedSlotHeight);
      this.placeTwoPartAnswerSlot(slotIndex, cursorX, equationY, fittedSlotWidth, fittedSlotHeight);
      slotIndex += 1;
      cursorX += part.width * scale;
    });

    this.updateAnswerText();
  }

  /** √の中に分数がある問題を、分数の縦書きレイアウトで描きます。 */
  private renderSquareRootFractionProblem(): void {
    if (!usesSquareRootFractionAnswer(this.problem)) {
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const numeratorY = equationY - 24;
    const lineY = equationY + 1;
    const denominatorY = equationY + 28;
    const slotWidth = 58;
    const slotHeight = 42;
    const fractionPadding = 8;
    const fractionStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '30px',
      fontStyle: '900',
      color: COLORS.ink,
      align: 'center',
    };
    const operatorStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '34px',
      fontStyle: '900',
      color: COLORS.ink,
    };

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.quotientAnswerBounds = null;
    this.remainderAnswerBounds = null;
    this.answerText.setFontSize(30);
    this.ensureRemainderAnswerText();
    this.remainderAnswerText?.setFontSize(30);

    const lineGraphics = this.scene.add.graphics();
    this.equationContainer.add(lineGraphics);
    const radicandFraction = this.createFractionEquationPart(
      this.problem.left,
      this.problem.right,
      null,
      numeratorY,
      denominatorY,
      slotWidth,
      fractionPadding,
      fractionStyle,
    );
    const equalsPart = this.createFractionInlineText(' = ', equationY, operatorStyle);
    const answerFractionWidth = slotWidth + fractionPadding * 2;
    const radicalContentWidth = radicandFraction.width;
    const radicalWidth = 34 + radicalContentWidth + 8;
    const totalWidth = radicalWidth + equalsPart.width + answerFractionWidth;
    const scale = this.getFormulaFitScale(totalWidth);
    const fittedSlotWidth = slotWidth * scale;
    const fittedSlotHeight = slotHeight * scale;
    const fittedAnswerFontSize = this.getFittedFontSize(30, scale, 20);
    const fittedTotalWidth = totalWidth * scale;
    let cursorX = this.getFormulaStartX(fittedTotalWidth);

    this.answerText.setFontSize(fittedAnswerFontSize);
    this.remainderAnswerText?.setFontSize(fittedAnswerFontSize);
    lineGraphics.lineStyle(Math.max(2, 3 * scale), Phaser.Display.Color.HexStringToColor(COLORS.ink).color, 1);

    const radicalX = cursorX;
    const fittedRadicalWidth = radicalWidth * scale;
    const fittedRadicalContentWidth = radicalContentWidth * scale;
    this.drawRadical(lineGraphics, radicalX, equationY - 12 * scale, fittedRadicalWidth, fittedRadicalContentWidth, scale);
    const radicandX = radicalX + ROOT_RADICAL_CONTENT_OFFSET * scale;
    this.placeFractionPart(
      radicandFraction,
      radicandX,
      numeratorY,
      lineY,
      denominatorY,
      fractionPadding,
      scale,
      lineGraphics,
    );
    cursorX += fittedRadicalWidth;

    equalsPart.text.setScale(scale);
    equalsPart.text.setX(cursorX);
    cursorX += equalsPart.width * scale;

    this.placeSquareRootFractionAnswer(
      cursorX,
      numeratorY,
      lineY,
      denominatorY,
      answerFractionWidth,
      fittedSlotWidth,
      fittedSlotHeight,
      fractionPadding,
      scale,
      lineGraphics,
    );
    this.updateAnswerText();
  }

  /** 分母の√をなくす問題を、元の分数と答えの分数を並べて描きます。 */
  private renderSquareRootRationalizeProblem(): void {
    if (!usesSquareRootRationalizeAnswer(this.problem)) {
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const numeratorY = equationY - 34;
    const lineY = equationY - 2;
    const denominatorY = equationY + 36;
    const slotWidth = 58;
    const slotHeight = 42;
    const fractionPadding = 8;
    const fractionStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '30px',
      fontStyle: '900',
      color: COLORS.ink,
      align: 'center',
    };
    const operatorStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '34px',
      fontStyle: '900',
      color: COLORS.ink,
    };

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.quotientAnswerBounds = null;
    this.remainderAnswerBounds = null;
    this.answerText.setFontSize(30);
    this.ensureRemainderAnswerText();
    this.remainderAnswerText?.setFontSize(30);

    const lineGraphics = this.scene.add.graphics();
    this.equationContainer.add(lineGraphics);
    const sourceNumerator = this.scene.add.text(0, numeratorY, String(this.problem.left), fractionStyle).setOrigin(0.5);
    const sourceDenominatorRoot = this.createRootRadicalPart(String(this.problem.right), false, denominatorY, slotWidth, fractionStyle);
    const equalsPart = this.createFractionInlineText(' = ', equationY, operatorStyle);
    const answerNumeratorRoot = this.createRootRadicalPart(String(this.problem.right), false, numeratorY, slotWidth, fractionStyle);
    const sourceFractionWidth = Math.max(sourceNumerator.width, sourceDenominatorRoot.width) + fractionPadding * 2;
    const answerFractionWidth = slotWidth + answerNumeratorRoot.width + fractionPadding * 2 + 4;
    const totalWidth = sourceFractionWidth + equalsPart.width + answerFractionWidth;
    const scale = this.getFormulaFitScale(totalWidth);
    const fittedSlotWidth = slotWidth * scale;
    const fittedSlotHeight = slotHeight * scale;
    const fittedAnswerFontSize = this.getFittedFontSize(30, scale, 20);
    const fittedTotalWidth = totalWidth * scale;
    let cursorX = this.getFormulaStartX(fittedTotalWidth);

    this.answerText.setFontSize(fittedAnswerFontSize);
    this.remainderAnswerText?.setFontSize(fittedAnswerFontSize);
    lineGraphics.lineStyle(Math.max(2, 3 * scale), Phaser.Display.Color.HexStringToColor(COLORS.ink).color, 1);
    this.equationContainer.add([
      sourceNumerator,
      equalsPart.text,
      ...(sourceDenominatorRoot.text ? [sourceDenominatorRoot.text] : []),
      ...(answerNumeratorRoot.text ? [answerNumeratorRoot.text] : []),
    ]);

    this.placeRationalizeSourceFraction(
      cursorX,
      sourceFractionWidth,
      sourceNumerator,
      sourceDenominatorRoot,
      numeratorY,
      lineY,
      denominatorY,
      fractionPadding,
      scale,
      lineGraphics,
    );
    cursorX += sourceFractionWidth * scale;

    equalsPart.text.setScale(scale);
    equalsPart.text.setX(cursorX);
    cursorX += equalsPart.width * scale;

    this.placeRationalizeAnswerFraction(
      cursorX,
      answerFractionWidth,
      answerNumeratorRoot,
      numeratorY,
      lineY,
      denominatorY,
      fittedSlotWidth,
      fittedSlotHeight,
      fractionPadding,
      scale,
      lineGraphics,
    );
    this.updateAnswerText();
  }

  /** 有理化問題の左側にある、元のa/√bの分数を配置します。 */
  private placeRationalizeSourceFraction(
    x: number,
    fractionWidth: number,
    numeratorText: Phaser.GameObjects.Text,
    denominatorRoot: Extract<RootEquationPart, { kind: 'radical' }>,
    numeratorY: number,
    lineY: number,
    denominatorY: number,
    padding: number,
    scale: number,
    graphics: Phaser.GameObjects.Graphics,
  ): void {
    const fittedFractionWidth = fractionWidth * scale;
    const centerX = x + fittedFractionWidth / 2;
    const denominatorRootX = centerX - denominatorRoot.width * scale / 2;
    const denominatorContentX = denominatorRootX + ROOT_RADICAL_CONTENT_OFFSET * scale;

    numeratorText.setScale(scale);
    numeratorText.setPosition(centerX, numeratorY);
    graphics.lineBetween(x + padding * scale, lineY, x + fittedFractionWidth - padding * scale, lineY);
    this.drawRadical(
      graphics,
      denominatorRootX,
      denominatorY,
      denominatorRoot.width * scale,
      denominatorRoot.contentWidth * scale,
      scale,
    );
    denominatorRoot.text?.setScale(scale);
    denominatorRoot.text?.setPosition(
      denominatorContentX + denominatorRoot.contentWidth * scale / 2,
      denominatorY + 3 * scale,
    );
  }

  /** 有理化問題の右側にある、□√b/□の答え分数を配置します。 */
  private placeRationalizeAnswerFraction(
    x: number,
    fractionWidth: number,
    numeratorRoot: Extract<RootEquationPart, { kind: 'radical' }>,
    numeratorY: number,
    lineY: number,
    denominatorY: number,
    slotWidth: number,
    slotHeight: number,
    padding: number,
    scale: number,
    graphics: Phaser.GameObjects.Graphics,
  ): void {
    const fittedFractionWidth = fractionWidth * scale;
    const numeratorX = x + padding * scale;
    const rootX = numeratorX + slotWidth + 4 * scale;
    const rootContentX = rootX + ROOT_RADICAL_CONTENT_OFFSET * scale;
    const denominatorX = x + fittedFractionWidth / 2 - slotWidth / 2;

    graphics.lineBetween(x + padding * scale, lineY, x + fittedFractionWidth - padding * scale, lineY);
    this.drawAnswerBox(numeratorX, numeratorY, slotWidth, slotHeight);
    this.placeTwoPartAnswerSlot(0, numeratorX, numeratorY, slotWidth, slotHeight);
    this.drawRadical(
      graphics,
      rootX,
      numeratorY,
      numeratorRoot.width * scale,
      numeratorRoot.contentWidth * scale,
      scale,
    );
    numeratorRoot.text?.setScale(scale);
    numeratorRoot.text?.setPosition(rootContentX + numeratorRoot.contentWidth * scale / 2, numeratorY + 3 * scale);
    this.drawAnswerBox(denominatorX, denominatorY, slotWidth, slotHeight);
    this.placeTwoPartAnswerSlot(1, denominatorX, denominatorY, slotWidth, slotHeight);
  }

  /** 分数部品を指定位置へ置き、分数線を描きます。 */
  private placeFractionPart(
    part: Extract<FractionEquationPart, { kind: 'fraction' }>,
    x: number,
    numeratorY: number,
    lineY: number,
    denominatorY: number,
    padding: number,
    scale: number,
    graphics: Phaser.GameObjects.Graphics,
  ): void {
    const fittedPartWidth = part.width * scale;
    const centerX = x + fittedPartWidth / 2;
    part.numeratorText?.setScale(scale);
    part.denominatorText?.setScale(scale);
    part.numeratorText?.setPosition(centerX, numeratorY);
    part.denominatorText?.setPosition(centerX, denominatorY);
    graphics.lineBetween(
      x + padding * scale,
      lineY,
      x + fittedPartWidth - padding * scale,
      lineY,
    );
  }

  /** √分数問題の答え欄を、分子と分母の二段の入力欄として置きます。 */
  private placeSquareRootFractionAnswer(
    x: number,
    numeratorY: number,
    lineY: number,
    denominatorY: number,
    fractionWidth: number,
    slotWidth: number,
    slotHeight: number,
    padding: number,
    scale: number,
    graphics: Phaser.GameObjects.Graphics,
  ): void {
    const fittedFractionWidth = fractionWidth * scale;
    const centerX = x + fittedFractionWidth / 2;
    const numeratorX = centerX - slotWidth / 2;
    const denominatorX = centerX - slotWidth / 2;
    graphics.lineBetween(
      x + padding * scale,
      lineY,
      x + fittedFractionWidth - padding * scale,
      lineY,
    );
    this.drawAnswerBox(numeratorX, numeratorY, slotWidth, slotHeight);
    this.drawAnswerBox(denominatorX, denominatorY, slotWidth, slotHeight);
    this.quotientAnswerBounds = { x: numeratorX, y: numeratorY, width: slotWidth, height: slotHeight };
    this.remainderAnswerBounds = { x: denominatorX, y: denominatorY, width: slotWidth, height: slotHeight };
    this.answerText.setPosition(centerX, numeratorY);
    this.remainderAnswerText?.setPosition(centerX, denominatorY);
  }

  /** √を含む数の大小問題を、番号選択で答えられるように描きます。 */
  private renderSquareRootComparisonProblem(): void {
    if (!usesSquareRootComparisonAnswer(this.problem)) {
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const slotWidth = CAPTURE_LAYOUT.problemFormula.slotWidth;
    const slotHeight = CAPTURE_LAYOUT.problemFormula.slotHeight;
    const prompt = this.scene.add
      .text(GAME_WIDTH / 2, equationY - 52, '大きいほうのばんごう', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    const optionText = this.scene.add
      .text(
        0,
        equationY,
        this.problem.rootComparisonTerms
          .map((term, index) => `(${index + 1}) ${this.formatSquareRootComparisonTerm(term)}`)
          .join('   '),
        {
          fontFamily: FONT_FAMILY,
          fontSize: '30px',
          fontStyle: '900',
          color: COLORS.ink,
        },
      )
      .setOrigin(0, 0.5);
    const optionScale = this.getFormulaFitScale(optionText.width);
    const fittedOptionWidth = optionText.width * optionScale;
    const answerY = equationY + 72;

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.clearRemainderAnswerText();
    this.answerText.setFontSize(34);
    this.equationContainer.add([prompt, optionText]);
    optionText.setScale(optionScale);
    optionText.setX(this.getFormulaStartX(fittedOptionWidth));
    this.drawAnswerBox(GAME_WIDTH / 2 - slotWidth / 2, answerY, slotWidth, slotHeight);
    this.answerText.setPosition(GAME_WIDTH / 2, answerY);
    this.updateAnswerText();
  }

  /** 大小比較の項を、√やマイナスつきで表示する文字列にします。 */
  private formatSquareRootComparisonTerm(term: SquareRootComparisonTerm): string {
    const sign = term.sign < 0 ? '-' : '';
    return term.kind === 'root' ? `${sign}√${term.value}` : `${sign}${term.value}`;
  }

  /** √の式の中で、そのまま表示する文字部品を作ります。 */
  private createRootInlineText(
    text: string,
    y: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): RootEquationPart {
    const textObject = this.scene.add.text(0, y, text, style).setOrigin(0, 0.5);
    return { kind: 'text', width: textObject.width, text: textObject };
  }

  /** 係数と√の中身を、横に並べられる式部品の配列へ分けます。 */
  private createRootTermParts(
    coefficient: number,
    radicand: number,
    y: number,
    slotWidth: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): RootEquationPart[] {
    const parts: RootEquationPart[] = [];
    if (coefficient !== 1) {
      parts.push(this.createRootInlineText(String(coefficient), y, style));
    }
    parts.push(this.createRootRadicalPart(String(radicand), false, y, slotWidth, style));
    return parts;
  }

  /** √記号つきの部品を作り、文字表示か入力欄かに応じて必要な幅を決めます。 */
  private createRootRadicalPart(
    value: string | null,
    hasSlot: boolean,
    y: number,
    slotWidth: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Extract<RootEquationPart, { kind: 'radical' }> {
    const text = value === null
      ? null
      : this.scene.add.text(0, y, value, style).setOrigin(0.5);
    const contentWidth = hasSlot ? slotWidth : Math.max(28, text?.width ?? 0);
    return {
      kind: 'radical',
      width: 34 + contentWidth + 8,
      contentWidth,
      text,
      hasSlot,
    };
  }

  /** √記号を線で描きます。全体幅と縮小率に合わせて線の位置も調整します。 */
  private drawRadical(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    contentWidth: number,
    scale = 1,
  ): void {
    const left = x + 2 * scale;
    const midY = y + 8 * scale;
    const bottomY = y + 24 * scale;
    const topY = y - 30 * scale;
    const turnX = x + 11 * scale;
    const bottomX = x + 17 * scale;
    const topX = x + ROOT_RADICAL_CONTENT_OFFSET * scale;
    const endX = x + 34 * scale + contentWidth + 4 * scale;

    graphics.lineBetween(left, midY, turnX, midY);
    graphics.lineBetween(turnX, midY, bottomX, bottomY);
    graphics.lineBetween(bottomX, bottomY, topX, topY);
    graphics.lineBetween(topX, topY, Math.min(endX, x + width - 2), topY);
  }

  /** 二枠回答の入力位置を保存し、対応する答えテキストを欄の中央に置きます。 */
  private placeTwoPartAnswerSlot(
    slotIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const bounds = { x, y, width, height };
    if (slotIndex === 0) {
      this.quotientAnswerBounds = bounds;
      this.answerText.setPosition(x + width / 2, y);
      return;
    }

    this.remainderAnswerBounds = bounds;
    this.remainderAnswerText?.setPosition(x + width / 2, y);
  }

  /** 分を時間と分に直す問題を描き、単独入力と二枠入力の両方を配置します。 */
  private renderClockMinuteConversionProblem(): void {
    if (!isClockMinuteConversionProblem(this.problem)) {
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const usesPairAnswer = usesClockMinuteConversionPairAnswer(this.problem);
    const slotWidth = usesPairAnswer ? 58 : 72;
    const slotHeight = CAPTURE_LAYOUT.problemFormula.slotHeight;
    const partGap = 8;
    const textStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: usesPairAnswer ? '30px' : '34px',
      fontStyle: '900',
      color: COLORS.ink,
    };
    const parts = usesPairAnswer
      ? [
          String(this.problem.left),
          '分 = ',
          null,
          '時間',
          null,
          '分',
        ]
      : [
          String(this.problem.left),
          '分 = ',
          this.problem.answerSlot === 'right' ? null : String(this.problem.right),
          '時間',
          this.problem.answerSlot === 'result' ? null : String(this.problem.result),
          '分',
        ];

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.quotientAnswerBounds = null;
    this.remainderAnswerBounds = null;
    this.answerText.setFontSize(usesPairAnswer ? 30 : 34);
    if (usesPairAnswer) {
      this.ensureRemainderAnswerText();
      this.remainderAnswerText?.setFontSize(30);
    } else {
      this.clearRemainderAnswerText();
    }

    const visibleParts = parts.map((part) => {
      if (part === null) {
        return { kind: 'slot' as const, width: slotWidth };
      }

      const text = this.scene.add.text(0, equationY, part, textStyle).setOrigin(0, 0.5);
      this.equationContainer.add(text);
      return { kind: 'text' as const, width: text.width, text };
    });
    const totalWidth = visibleParts.reduce((sum, part) => sum + part.width, 0) + partGap * (visibleParts.length - 1);
    const scale = this.getFormulaFitScale(totalWidth);
    const fittedSlotWidth = slotWidth * scale;
    const fittedSlotHeight = slotHeight * scale;
    const fittedTotalWidth = totalWidth * scale;
    const fittedAnswerFontSize = this.getFittedFontSize(usesPairAnswer ? 30 : 34, scale, 20);
    this.answerText.setFontSize(fittedAnswerFontSize);
    this.remainderAnswerText?.setFontSize(fittedAnswerFontSize);
    let cursorX = this.getFormulaStartX(fittedTotalWidth);
    let slotIndex = 0;

    visibleParts.forEach((part) => {
      if (part.kind === 'slot') {
        this.drawAnswerBox(cursorX, equationY, fittedSlotWidth, fittedSlotHeight);
        if (usesPairAnswer) {
          this.placeTwoPartAnswerSlot(slotIndex, cursorX, equationY, fittedSlotWidth, fittedSlotHeight);
          slotIndex += 1;
        } else {
          this.answerText.setPosition(cursorX + fittedSlotWidth / 2, equationY);
        }
        cursorX += fittedSlotWidth + partGap * scale;
        return;
      }

      part.text.setScale(scale);
      part.text.setX(cursorX);
      cursorX += (part.width + partGap) * scale;
    });

    this.updateAnswerText();
  }

  /** Draws a rectangle with side labels so area problems are read visually, not just as text. */
  private renderShapeAreaProblem(): void {
    if (!isShapeAreaProblem(this.problem)) {
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const answerDigits = getCaptureAnswerMaxDigits(this.problem);
    const slotWidth = answerDigits >= 3 ? 94 : 66;
    const slotHeight = 50;
    const answerY = equationY + 86;
    const heightLabel = this.problem.answerSlot === 'left' ? '□' : String(this.problem.left);
    const widthLabel = this.problem.answerSlot === 'right' ? '□' : String(this.problem.right);
    const areaLabel = this.problem.answerSlot === 'result' ? '□' : String(this.problem.result);

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.answerText.setFontSize(answerDigits >= 3 ? 30 : 32);
    this.drawShapeAreaDiagram(equationY - 12, heightLabel, widthLabel, 62, 44);

    if (this.problem.answerSlot === 'result') {
      const promptText = this.scene.add
        .text(0, answerY, 'ひろさ =', {
          fontFamily: FONT_FAMILY,
          fontSize: '28px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0, 0.5);
      const gap = 10;
      const totalWidth = promptText.width + gap + slotWidth;
      const textX = GAME_WIDTH / 2 - totalWidth / 2;
      const slotX = textX + promptText.width + gap;
      promptText.setX(textX);
      this.equationContainer.add(promptText);
      this.drawAnswerBox(slotX, answerY, slotWidth, slotHeight);
      this.answerText.setPosition(slotX + slotWidth / 2, answerY);
      this.updateAnswerText();
      return;
    }

    const promptText = this.scene.add
      .text(GAME_WIDTH / 2, answerY, `ひろさ = ${areaLabel}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);
    this.equationContainer.add(promptText);
    this.updateAnswerText();
  }

  /** Draws the rectangle and its grid/side labels for the current area problem. */
  private drawShapeAreaDiagram(
    centerY: number,
    heightLabel: string,
    widthLabel: string,
    slotWidth: number,
    slotHeight: number,
  ): void {
    if (!isShapeAreaProblem(this.problem)) {
      return;
    }

    const rows = Phaser.Math.Clamp(Math.floor(this.problem.left), 1, 12);
    const cols = Phaser.Math.Clamp(Math.floor(this.problem.right), 1, 12);
    const maxWidth = 160;
    const maxHeight = 88;
    const cellSize = Math.min(maxWidth / cols, maxHeight / rows, 22);
    const rectWidth = cols * cellSize;
    const rectHeight = rows * cellSize;
    const rectX = GAME_WIDTH / 2 - rectWidth / 2;
    const rectY = centerY - rectHeight / 2;
    const graphics = this.scene.add.graphics();
    const accent = Phaser.Display.Color.HexStringToColor(this.accentColor).color;
    const panel = Phaser.Display.Color.HexStringToColor(COLORS.panel).color;
    const line = Phaser.Display.Color.HexStringToColor(COLORS.line).color;

    graphics.fillStyle(panel, 0.94);
    graphics.lineStyle(3, accent, 1);
    graphics.fillRect(rectX, rectY, rectWidth, rectHeight);
    graphics.strokeRect(rectX, rectY, rectWidth, rectHeight);
    graphics.lineStyle(1, line, 0.28);
    for (let column = 1; column < cols; column += 1) {
      const x = rectX + column * cellSize;
      graphics.lineBetween(x, rectY + 2, x, rectY + rectHeight - 2);
    }
    for (let row = 1; row < rows; row += 1) {
      const y = rectY + row * cellSize;
      graphics.lineBetween(rectX + 2, y, rectX + rectWidth - 2, y);
    }
    this.equationContainer.add(graphics);

    const labelStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      fontStyle: '900',
      color: COLORS.ink,
      align: 'center',
      lineSpacing: 0,
    };
    if (this.problem.answerSlot === 'left') {
      const labelX = rectX - 32;
      const labelY = rectY + rectHeight / 2 - 17;
      const slotY = rectY + rectHeight / 2 + 18;
      const heightText = this.scene.add.text(labelX, labelY, 'たて', labelStyle).setOrigin(0.5);
      this.equationContainer.add(heightText);
      this.drawAnswerBox(labelX - slotWidth / 2, slotY, slotWidth, slotHeight);
      this.answerText.setPosition(labelX, slotY);
    } else {
      const heightText = this.scene.add
        .text(rectX - 28, rectY + rectHeight / 2, `たて\n${heightLabel}`, labelStyle)
        .setOrigin(0.5);
      this.equationContainer.add(heightText);
    }

    if (this.problem.answerSlot === 'right') {
      const labelY = rectY + rectHeight + 24;
      const labelText = this.scene.add.text(GAME_WIDTH / 2 - 48, labelY, 'よこ', labelStyle).setOrigin(0.5);
      const slotX = GAME_WIDTH / 2 - 8;
      this.equationContainer.add(labelText);
      this.drawAnswerBox(slotX, labelY, slotWidth, slotHeight);
      this.answerText.setPosition(slotX + slotWidth / 2, labelY);
    } else {
      const widthText = this.scene.add
        .text(GAME_WIDTH / 2, rectY + rectHeight + 22, `よこ ${widthLabel}`, labelStyle)
        .setOrigin(0.5);
      this.equationContainer.add(widthText);
    }
  }

  /** Draws vertical arithmetic as a right-aligned written calculation with a rule line. */
  private renderVerticalArithmeticProblem(): void {
    if (!isVerticalArithmeticProblem(this.problem)) {
      return;
    }

    if (usesPlaceValueAnswer(this.problem)) {
      this.renderPlaceValueArithmeticProblem();
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const answerDigits = getCaptureAnswerMaxDigits(this.problem);
    const slotWidth = answerDigits >= 3 ? 122 : 104;
    const slotHeight = 54;
    const answerY = equationY + 106;
    const rightEdgeX = GAME_WIDTH / 2 + 44;
    const operatorX = rightEdgeX - 82;
    const leftText = this.problem.answerSlot === 'left' ? '□' : String(this.problem.left);
    const rightText = this.problem.answerSlot === 'right' ? '□' : String(this.problem.right);
    const resultText = this.problem.answerSlot === 'result' ? '□' : String(this.problem.result);
    const textStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '25px',
      fontStyle: '900',
      color: COLORS.ink,
      align: 'right',
    };

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.answerText.setFontSize(answerDigits >= 3 ? 30 : 32);

    const title = this.scene.add
      .text(GAME_WIDTH / 2, equationY - 38, 'ひっ算', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
    const topNumber = this.scene.add.text(rightEdgeX, equationY - 10, leftText, textStyle).setOrigin(1, 0.5);
    const operator = this.scene.add
      .text(operatorX, equationY + 18, this.problem.operator, {
        ...textStyle,
        fontSize: '23px',
      })
      .setOrigin(0.5);
    const bottomNumber = this.scene.add.text(rightEdgeX, equationY + 18, rightText, textStyle).setOrigin(1, 0.5);
    const resultNumber = this.scene.add.text(rightEdgeX, equationY + 52, resultText, textStyle).setOrigin(1, 0.5);
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.ink).color, 1);
    graphics.lineBetween(operatorX - 10, equationY + 36, rightEdgeX + 4, equationY + 36);

    this.equationContainer.add([title, topNumber, operator, bottomNumber, resultNumber, graphics]);
    this.drawAnswerBox(GAME_WIDTH / 2 - slotWidth / 2, answerY, slotWidth, slotHeight);
    this.answerText.setPosition(GAME_WIDTH / 2, answerY);
    this.updateAnswerText();
  }

  /** Aligns operand digits and answer cells, with the ones column on the right. */
  private renderPlaceValueArithmeticProblem(): void {
    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const answerDigits = getCaptureAnswerMaxDigits(this.problem);
    const columnCount = Math.max(answerDigits, String(this.problem.left).length, String(this.problem.right).length);
    const columnGap = 54;
    const cellWidth = 42;
    const cellHeight = 48;
    const onesX = GAME_WIDTH / 2 + (columnCount - 1) * columnGap / 2;
    const operatorX = onesX - columnCount * columnGap;
    const answerY = equationY + 84;
    const textStyle = { fontFamily: FONT_FAMILY, fontSize: '30px', fontStyle: '900', color: COLORS.ink };

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.answerText.setVisible(false);
    this.equationContainer.add(this.scene.add.text(GAME_WIDTH / 2, equationY - 52, 'ひっ算', {
      ...textStyle, fontSize: '22px',
    }).setOrigin(0.5));

    for (const [row, value] of [this.problem.left, this.problem.right].entries()) {
      const digits = String(value).split('').reverse();
      digits.forEach((digit, place) => {
        this.equationContainer.add(this.scene.add.text(onesX - place * columnGap, equationY - 12 + row * 36, digit, textStyle).setOrigin(0.5));
      });
    }
    this.equationContainer.add(this.scene.add.text(operatorX, equationY + 24, this.problem.operator, textStyle).setOrigin(0.5));
    const rule = this.scene.add.graphics();
    rule.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.ink).color, 1);
    rule.lineBetween(operatorX - 16, equationY + 46, onesX + cellWidth / 2, equationY + 46);
    this.equationContainer.add(rule);

    for (let place = 0; place < answerDigits; place += 1) {
      const centerX = onesX - place * columnGap;
      this.placeValueSlots.push({ x: centerX - cellWidth / 2, y: answerY, width: cellWidth, height: cellHeight });
      this.drawAnswerBox(centerX - cellWidth / 2, answerY, cellWidth, cellHeight);
      const digit = this.scene.add.text(centerX, answerY, '', textStyle).setOrigin(0.5);
      this.placeValueDigits.push(digit);
      this.equationContainer.add(digit);
    }
    this.equationContainer.add(this.scene.add.text(GAME_WIDTH / 2, equationY + 122, '一のくらいから 入れよう', {
      ...textStyle, fontSize: '14px',
    }).setOrigin(0.5));
    this.updateAnswerText();
  }

  /** Places entered digits in their columns and highlights the next empty place. */
  private updatePlaceValueAnswer(): void {
    const enteredDigits = this.input.first.split('').reverse();
    this.placeValueDigits.forEach((text, place) => text.setText(enteredDigits[place] ?? ''));
    this.activeAnswerBox.clear();
    const nextSlot = this.placeValueSlots[enteredDigits.length];
    if (nextSlot) {
      this.activeAnswerBox.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.blue).color, 0.95);
      this.activeAnswerBox.strokeRoundedRect(nextSlot.x, nextSlot.y - nextSlot.height / 2, nextSlot.width, nextSlot.height, 14);
    }
  }

  /** Gives the scene the visible answer position and width for its correct mark. */
  getCorrectMarkTarget(): { x: number; y: number; width: number } {
    const ones = this.placeValueSlots[0];
    const highest = this.placeValueSlots[this.placeValueSlots.length - 1];
    if (ones && highest) {
      return { x: (highest.x + ones.x + ones.width) / 2, y: ones.y, width: ones.x + ones.width - highest.x };
    }
    if (this.remainderAnswerText) {
      return {
        x: (this.answerText.x + this.remainderAnswerText.x) / 2,
        y: (this.answerText.y + this.remainderAnswerText.y) / 2,
        width: Math.abs(this.remainderAnswerText.x - this.answerText.x) + 58,
      };
    }
    return { x: this.answerText.x, y: this.answerText.y, width: Math.max(this.answerText.width, this.answerText.height) };
  }

  /** Draws newer multi-line problem types with a separate answer box below the prompt. */
  private renderTextFormulaProblem(): void {
    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const prompt = formatProblem(this.problem);
    const lineCount = prompt.split('\n').length;
    const isTallPrompt = lineCount >= 4;
    const promptY = isTallPrompt ? equationY + 2 : equationY - 10;
    const answerY = isTallPrompt ? equationY + 90 : equationY + 78;
    const slotWidth = isMissingDigitArithmeticProblem(this.problem) ? 58 : 104;
    const slotHeight = isTallPrompt ? 52 : 60;
    const promptText = this.scene.add
      .text(GAME_WIDTH / 2, promptY, prompt, {
        fontFamily: FONT_FAMILY,
        fontSize: isTallPrompt ? '24px' : '30px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: isTallPrompt ? 0 : 6,
      })
      .setOrigin(0.5);
    const scale = this.getFormulaFitScale(Math.max(promptText.width, slotWidth));

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.answerText.setFontSize(isMissingDigitArithmeticProblem(this.problem) ? 34 : isTallPrompt ? 28 : 30);
    this.equationContainer.add(promptText);
    promptText.setScale(scale);
    this.drawAnswerBox(GAME_WIDTH / 2 - slotWidth / 2, answerY, slotWidth, slotHeight);
    this.answerText.setPosition(GAME_WIDTH / 2, answerY);
    this.updateAnswerText();
  }

  /** Draws regular horizontal integer and decimal equations with an inline answer box. */
  private renderIntegerProblem(): void {
    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const slotWidth = isDecimalProblem(this.problem) ? 102 : CAPTURE_LAYOUT.problemFormula.slotWidth;
    const slotHeight = CAPTURE_LAYOUT.problemFormula.slotHeight;
    const textStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '42px',
      fontStyle: '900',
      color: COLORS.ink,
    };
    const leftText = isDecimalProblem(this.problem)
      ? this.formatDecimalProblemValue(this.problem.left, this.problem.leftDecimalPlaces)
      : String(this.problem.left);
    const rightText = isDecimalProblem(this.problem)
      ? this.formatDecimalProblemValue(this.problem.right, this.problem.rightDecimalPlaces)
      : String(this.problem.right);
    const resultText = isDecimalProblem(this.problem)
      ? this.formatDecimalProblemValue(this.problem.result, this.problem.resultDecimalPlaces)
      : String(this.problem.result);
    const parts = [
      this.problem.answerSlot === 'left' ? null : leftText,
      ` ${this.problem.operator} `,
      this.problem.answerSlot === 'right' ? null : rightText,
      ' = ',
      this.problem.answerSlot === 'result' ? null : resultText,
    ];
    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.answerText.setFontSize(34);

    const visibleParts = parts.map((part) => {
      if (part === null) {
        return { kind: 'slot' as const, width: slotWidth };
      }

      const text = this.scene.add.text(0, equationY, part, textStyle).setOrigin(0, 0.5);
      this.equationContainer.add(text);
      return { kind: 'text' as const, width: text.width, text };
    });
    const totalWidth = visibleParts.reduce((sum, part) => sum + part.width, 0);
    const scale = this.getFormulaFitScale(totalWidth);
    const fittedSlotWidth = slotWidth * scale;
    const fittedSlotHeight = slotHeight * scale;
    const fittedTotalWidth = totalWidth * scale;
    this.answerText.setFontSize(this.getFittedFontSize(34, scale, 22));
    let cursorX = this.getFormulaStartX(fittedTotalWidth);

    visibleParts.forEach((part) => {
      if (part.kind === 'slot') {
        this.drawAnswerBox(cursorX, equationY, fittedSlotWidth, fittedSlotHeight);
        this.answerText.setPosition(cursorX + fittedSlotWidth / 2, equationY);
        cursorX += fittedSlotWidth;
        return;
      }

      part.text.setScale(scale);
      part.text.setX(cursorX);
      cursorX += part.width * scale;
    });
  }

  /** 小数問題の表示用に、指定けた数で整えたあと余分な0を取り除きます。 */
  private formatDecimalProblemValue(value: number, decimalPlaces: number | undefined): string {
    const places = Math.max(0, Math.min(3, Math.floor(decimalPlaces ?? 1)));
    return value
      .toFixed(places)
      .replace(/(\.\d*?)0+$/, '$1')
      .replace(/\.$/, '');
  }

  /** 時計を読む問題を描き、左に時計、右に時分の答え欄を配置します。 */
  private renderClockProblem(): void {
    if (!isClockTimeProblem(this.problem)) {
      return;
    }

    const centerY = CAPTURE_LAYOUT.problemFormula.y + 30;
    const clockRadius = 68;
    const clockCenterX = 114;
    const answerWidth = this.problem.answerSlot === 'result' && this.problem.right !== 0 ? 132 : 72;
    const answerHeight = 62;
    const labelStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '28px',
      fontStyle: '900',
      color: COLORS.ink,
    };

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.answerText.setFontSize(this.problem.answerSlot === 'result' && this.problem.right !== 0 ? 24 : 34);
    this.drawAnalogClock(
      clockCenterX,
      centerY,
      clockRadius,
      this.problem.left,
      this.problem.right,
      this.problem.minuteStep === 1,
    );

    const parts = this.getClockAnswerParts(answerWidth, centerY, labelStyle);
    const partGap = 8;
    const totalWidth = parts.reduce((sum, part) => sum + part.width, 0) + partGap * (parts.length - 1);
    const answerLeft = clockCenterX + clockRadius + 16;
    const answerRight = CAPTURE_LAYOUT.regions.question.x + CAPTURE_LAYOUT.regions.question.width - FORMULA_HORIZONTAL_PADDING;
    const scale = Math.min(1, (answerRight - answerLeft) / totalWidth);
    const fittedAnswerWidth = answerWidth * scale;
    const fittedAnswerHeight = answerHeight * scale;
    this.answerText.setFontSize(this.getFittedFontSize(this.problem.answerSlot === 'result' && this.problem.right !== 0 ? 24 : 34, scale, 20));
    let cursorX = answerLeft + (answerRight - answerLeft - totalWidth * scale) / 2;
    parts.forEach((part) => {
      if (part.kind === 'slot') {
        this.drawAnswerBox(cursorX, centerY, fittedAnswerWidth, fittedAnswerHeight);
        this.answerText.setPosition(cursorX + fittedAnswerWidth / 2, centerY);
        cursorX += fittedAnswerWidth + partGap * scale;
        return;
      }

      part.text.setScale(scale).setX(cursorX);
      cursorX += (part.width + partGap) * scale;
    });
  }

  /** 時計問題の答え部分を、入力欄と「時」「分」の文字部品に分解します。 */
  private getClockAnswerParts(
    answerWidth: number,
    centerY: number,
    labelStyle: Phaser.Types.GameObjects.Text.TextStyle,
  ): Array<{ kind: 'slot'; width: number } | { kind: 'text'; width: number; text: Phaser.GameObjects.Text }> {
    const rawParts = this.problem.answerSlot === 'left'
      ? [
          null,
          '時',
          ...(this.problem.right === 0 ? [] : [String(this.problem.right), '分']),
        ]
      : this.problem.answerSlot === 'right'
        ? [
            String(this.problem.left),
            '時',
            null,
            '分',
          ]
        : [null, ...(this.problem.right === 0 ? ['時'] : [])];

    return rawParts.map((part) => {
      if (part === null) {
        return { kind: 'slot' as const, width: answerWidth };
      }

      const text = this.scene.add.text(0, centerY, part, labelStyle).setOrigin(0, 0.5);
      this.equationContainer.add(text);
      return { kind: 'text' as const, width: text.width, text };
    });
  }

  /** Draws hour and minute answer slots for clock time answers. */
  private drawClockElapsedTimeAnswerRow(y: number): void {
    const slotWidth = 60;
    const slotHeight = 56;
    const partGap = 8;
    const textStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '26px',
      fontStyle: '900',
      color: COLORS.ink,
    };
    const parts = ['時こくは ', null, '時', null, '分'];
    const visibleParts = parts.map((part) => {
      if (part === null) {
        return { kind: 'slot' as const, width: slotWidth };
      }

      const text = this.scene.add.text(0, y, part, textStyle).setOrigin(0, 0.5);
      this.equationContainer.add(text);
      return { kind: 'text' as const, width: text.width, text };
    });
    const totalWidth = visibleParts.reduce((sum, part) => sum + part.width, 0) + partGap * (visibleParts.length - 1);
    const scale = this.getFormulaFitScale(totalWidth);
    const fittedSlotWidth = slotWidth * scale;
    const fittedSlotHeight = slotHeight * scale;
    const fittedTotalWidth = totalWidth * scale;
    const fittedAnswerFontSize = this.getFittedFontSize(26, scale, 20);
    let cursorX = this.getFormulaStartX(fittedTotalWidth);
    let slotIndex = 0;

    this.answerText.setFontSize(fittedAnswerFontSize);
    this.remainderAnswerText?.setFontSize(fittedAnswerFontSize);
    visibleParts.forEach((part) => {
      if (part.kind === 'slot') {
        this.drawAnswerBox(cursorX, y, fittedSlotWidth, fittedSlotHeight);
        this.placeTwoPartAnswerSlot(slotIndex, cursorX, y, fittedSlotWidth, fittedSlotHeight);
        slotIndex += 1;
        cursorX += fittedSlotWidth + partGap * scale;
        return;
      }

      part.text.setScale(scale);
      part.text.setX(cursorX);
      cursorX += (part.width + partGap) * scale;
    });
  }

  /** Draws two clock elapsed problem styles and their answer slots. */
  private renderClockElapsedMinutesProblem(): void {
    if (!isClockElapsedMinutesProblem(this.problem)) {
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const usesHourAnswer = usesClockElapsedHoursAnswer(this.problem);
    const usesTimeAnswer = usesClockElapsedTimeAnswer(this.problem);
    const usesTextOnly = this.problem.clockDisplayMode === 'text';
    const clockY = equationY - 12;
    const answerY = equationY + 92;
    const clockRadius = 48;
    const leftClockX = 106;
    const rightClockX = 284;
    const slotWidth = 76;
    const slotHeight = 56;
    const startHour = this.getClockHourFromTotalMinutes(this.problem.left);
    const startMinute = this.getClockMinuteFromTotalMinutes(this.problem.left);
    const endHour = this.getClockHourFromTotalMinutes(this.problem.right);
    const endMinute = this.getClockMinuteFromTotalMinutes(this.problem.right);

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.activeAnswerBox.clear();
    this.quotientAnswerBounds = null;
    this.remainderAnswerBounds = null;
    this.answerText.setFontSize(usesTimeAnswer ? 30 : 32);
    if (usesTimeAnswer) {
      this.ensureRemainderAnswerText();
      this.remainderAnswerText?.setFontSize(30);
    } else {
      this.clearRemainderAnswerText();
    }

    if (usesTextOnly) {
      const startTime = `${startHour}時${startMinute === 0 ? '' : `${startMinute}分`}`;
      const endTime = `${endHour}時${endMinute === 0 ? '' : `${endMinute}分`}`;
      const text = usesTimeAnswer
        ? `${startTime}から ${this.problem.result}分後`
        : `${startTime}から ${endTime}`;
      const question = this.scene.add
        .text(GAME_WIDTH / 2, equationY - 36, text, {
          fontFamily: FONT_FAMILY,
          fontSize: '30px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
        })
        .setOrigin(0.5);
      this.equationContainer.add(question);
    } else if (usesTimeAnswer) {
      const futureClockY = equationY;
      this.drawAnalogClock(leftClockX, futureClockY, clockRadius, startHour, startMinute, this.problem.minuteStep === 1);
      this.drawAnalogClock(rightClockX, futureClockY, clockRadius, 0, 0, this.problem.minuteStep === 1, true);
      const arrow = this.scene.add
        .text(GAME_WIDTH / 2, futureClockY, '→', {
          fontFamily: FONT_FAMILY,
          fontSize: '34px',
          fontStyle: '900',
          color: COLORS.ink,
        })
        .setOrigin(0.5);
      const elapsedLabel = this.scene.add
        .text(GAME_WIDTH / 2, equationY - 52, `${this.problem.result}分後`, {
          fontFamily: FONT_FAMILY,
          fontSize: '22px',
          fontStyle: '900',
          color: COLORS.ink,
        })
        .setOrigin(0.5);
      this.equationContainer.add([arrow, elapsedLabel]);
    } else {
      this.drawAnalogClock(leftClockX, clockY, clockRadius, startHour, startMinute, this.problem.minuteStep === 1);
      this.drawAnalogClock(rightClockX, clockY, clockRadius, endHour, endMinute, this.problem.minuteStep === 1);
      const arrow = this.scene.add
        .text(GAME_WIDTH / 2, clockY, '→', {
          fontFamily: FONT_FAMILY,
          fontSize: '34px',
          fontStyle: '900',
          color: COLORS.ink,
        })
        .setOrigin(0.5);
      this.equationContainer.add(arrow);
    }

    if (usesTimeAnswer) {
      this.drawClockElapsedTimeAnswerRow(answerY);
      this.updateAnswerText();
      return;
    }

    const labelStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '28px',
      fontStyle: '900',
      color: COLORS.ink,
    };
    const leftLabel = this.scene.add.text(0, answerY, '時間は ', labelStyle).setOrigin(0, 0.5);
    const rightLabel = this.scene.add.text(0, answerY, usesHourAnswer ? '時間' : '分', labelStyle).setOrigin(0, 0.5);
    const gap = 8;
    const totalWidth = leftLabel.width + gap + slotWidth + gap + rightLabel.width;
    let cursorX = GAME_WIDTH / 2 - totalWidth / 2;
    leftLabel.setX(cursorX);
    cursorX += leftLabel.width + gap;
    this.drawAnswerBox(cursorX, answerY, slotWidth, slotHeight);
    this.answerText.setPosition(cursorX + slotWidth / 2, answerY);
    cursorX += slotWidth + gap;
    rightLabel.setX(cursorX);
    this.equationContainer.add([leftLabel, rightLabel]);
    this.updateAnswerText();
  }

  /** Converts total clock minutes into a 12-hour clock hour. */
  private getClockHourFromTotalMinutes(totalMinutes: number): number {
    const hour = Math.floor((((totalMinutes % 720) + 720) % 720) / 60);
    return hour === 0 ? 12 : hour;
  }

  /** Converts total clock minutes into the minute shown on a clock. */
  private getClockMinuteFromTotalMinutes(totalMinutes: number): number {
    return ((totalMinutes % 60) + 60) % 60;
  }

  /** Draws a clock face; an unknown time shows a question mark without hands or answer hints. */
  private drawAnalogClock(
    centerX: number,
    centerY: number,
    radius: number,
    hour: number,
    minute: number,
    showMinuteMarks: boolean,
    isUnknown = false,
  ): void {
    const graphics = this.scene.add.graphics();
    this.equationContainer.add(graphics);

    const inkColor = Phaser.Display.Color.HexStringToColor(COLORS.ink).color;
    const lineColor = Phaser.Display.Color.HexStringToColor(COLORS.line).color;
    const panelColor = Phaser.Display.Color.HexStringToColor(COLORS.panel).color;
    const blueColor = Phaser.Display.Color.HexStringToColor(COLORS.blue).color;
    const targetMinuteColor = Phaser.Display.Color.HexStringToColor(COLORS.red).color;
    graphics.fillStyle(lineColor, 0.14);
    graphics.fillCircle(centerX + 3, centerY + 4, radius);
    graphics.fillStyle(panelColor, 1);
    graphics.fillCircle(centerX, centerY, radius);
    graphics.lineStyle(4, lineColor, 1);
    graphics.strokeCircle(centerX, centerY, radius);

    if (showMinuteMarks) {
      for (let mark = 0; mark < 60; mark += 1) {
        if (mark % 5 === 0) {
          continue;
        }

        const angle = (mark / 60) * Math.PI * 2 - Math.PI / 2;
        const isTargetMinute = !isUnknown && mark === minute;
        const innerRadius = radius - (isTargetMinute ? 14 : 7);
        const outerRadius = radius - 3;
        graphics.lineStyle(isTargetMinute ? 4 : 1, isTargetMinute ? targetMinuteColor : lineColor, isTargetMinute ? 1 : 0.24);
        graphics.lineBetween(
          centerX + Math.cos(angle) * innerRadius,
          centerY + Math.sin(angle) * innerRadius,
          centerX + Math.cos(angle) * outerRadius,
          centerY + Math.sin(angle) * outerRadius,
        );
      }
    }

    for (let mark = 0; mark < 60; mark += 5) {
      const angle = (mark / 60) * Math.PI * 2 - Math.PI / 2;
      const isQuarter = mark % 15 === 0;
      const isTargetMinute = !isUnknown && showMinuteMarks && mark === minute;
      const innerRadius = radius - (isTargetMinute ? 18 : isQuarter ? 14 : 10);
      const outerRadius = radius - 3;
      graphics.lineStyle(
        isTargetMinute ? 5 : isQuarter ? 3 : 2,
        isTargetMinute ? targetMinuteColor : lineColor,
        isTargetMinute ? 1 : isQuarter ? 0.9 : 0.55,
      );
      graphics.lineBetween(
        centerX + Math.cos(angle) * innerRadius,
        centerY + Math.sin(angle) * innerRadius,
        centerX + Math.cos(angle) * outerRadius,
        centerY + Math.sin(angle) * outerRadius,
      );
    }

    for (let clockHour = 1; clockHour <= 12; clockHour += 1) {
      const angle = (clockHour / 12) * Math.PI * 2 - Math.PI / 2;
      const numberText = this.scene.add.text(
        centerX + Math.cos(angle) * (radius - 21),
        centerY + Math.sin(angle) * (radius - 21),
        String(clockHour),
        {
          fontFamily: FONT_FAMILY,
          fontSize: clockHour >= 10 ? '12px' : '14px',
          fontStyle: '900',
          color: COLORS.ink,
        },
      ).setOrigin(0.5);
      this.equationContainer.add(numberText);
    }

    if (isUnknown) {
      this.equationContainer.add(this.scene.add.text(centerX, centerY, '?', {
        fontFamily: FONT_FAMILY, fontSize: '30px', fontStyle: '900', color: COLORS.ink,
      }).setOrigin(0.5));
      return;
    }

    const hourAngle = (((hour % 12) + minute / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    const minuteAngle = (minute / 60) * Math.PI * 2 - Math.PI / 2;
    graphics.lineStyle(5, inkColor, 1);
    graphics.lineBetween(
      centerX,
      centerY,
      centerX + Math.cos(hourAngle) * (radius * 0.44),
      centerY + Math.sin(hourAngle) * (radius * 0.44),
    );
    graphics.lineStyle(3, blueColor, 1);
    graphics.lineBetween(
      centerX,
      centerY,
      centerX + Math.cos(minuteAngle) * (radius * 0.7),
      centerY + Math.sin(minuteAngle) * (radius * 0.7),
    );
    graphics.fillStyle(inkColor, 1);
    graphics.fillCircle(centerX, centerY, 5);
    graphics.fillStyle(panelColor, 1);
    graphics.fillCircle(centerX, centerY, 2);
  }

  /** 分数問題を描き、分子または分母の空欄へ答え欄を合わせます。 */
  private renderFractionProblem(): void {
    if (!isFractionProblem(this.problem)) {
      return;
    }

    const leftDenominator = this.problem.leftDenominator ?? this.problem.denominator;
    const rightDenominator = this.problem.rightDenominator ?? this.problem.denominator;
    const resultDenominator = this.problem.resultDenominator ?? this.problem.denominator;
    const isEquivalentFraction = this.problem.kind === 'equivalentFraction';
    if (!leftDenominator || !rightDenominator || (!isEquivalentFraction && !resultDenominator)) {
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const numeratorY = equationY - 24;
    const lineY = equationY + 1;
    const denominatorY = equationY + 28;
    const slotWidth = 58;
    const slotHeight = 42;
    const fractionPadding = 8;
    const fractionStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '30px',
      fontStyle: '900',
      color: COLORS.ink,
      align: 'center',
    };
    const operatorStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '34px',
      fontStyle: '900',
      color: COLORS.ink,
    };

    this.equationContainer.removeAll(true);
    this.answerBox.clear();
    this.answerText.setFontSize(30);

    const lineGraphics = this.scene.add.graphics();
    this.equationContainer.add(lineGraphics);
    const parts: FractionEquationPart[] = isEquivalentFraction ? [
      this.createFractionEquationPart(
        this.problem.left,
        leftDenominator,
        this.getFractionAnswerSlot('left'),
        numeratorY,
        denominatorY,
        slotWidth,
        fractionPadding,
        fractionStyle,
      ),
      this.createFractionInlineText(' = ', equationY, operatorStyle),
      this.createFractionEquationPart(
        this.problem.right,
        rightDenominator,
        this.getFractionAnswerSlot('right'),
        numeratorY,
        denominatorY,
        slotWidth,
        fractionPadding,
        fractionStyle,
      ),
    ] : [
      this.createFractionEquationPart(
        this.problem.left,
        leftDenominator,
        this.getFractionAnswerSlot('left'),
        numeratorY,
        denominatorY,
        slotWidth,
        fractionPadding,
        fractionStyle,
      ),
      this.createFractionInlineText(` ${this.problem.operator} `, equationY, operatorStyle),
      this.createFractionEquationPart(
        this.problem.right,
        rightDenominator,
        this.getFractionAnswerSlot('right'),
        numeratorY,
        denominatorY,
        slotWidth,
        fractionPadding,
        fractionStyle,
      ),
      this.createFractionInlineText(' = ', equationY, operatorStyle),
      this.createFractionEquationPart(
        this.problem.result,
        resultDenominator ?? leftDenominator,
        this.getFractionAnswerSlot('result'),
        numeratorY,
        denominatorY,
        slotWidth,
        fractionPadding,
        fractionStyle,
      ),
    ];

    const totalWidth = parts.reduce((sum, part) => sum + part.width, 0);
    const scale = this.getFormulaFitScale(totalWidth);
    const fittedSlotWidth = slotWidth * scale;
    const fittedSlotHeight = slotHeight * scale;
    const fittedTotalWidth = totalWidth * scale;
    this.answerText.setFontSize(this.getFittedFontSize(30, scale, 20));
    let cursorX = this.getFormulaStartX(fittedTotalWidth);
    lineGraphics.lineStyle(Math.max(2, 3 * scale), Phaser.Display.Color.HexStringToColor(COLORS.ink).color, 1);

    parts.forEach((part) => {
      if (part.kind === 'text') {
        part.text.setScale(scale);
        part.text.setX(cursorX);
        cursorX += part.width * scale;
        return;
      }

      const fittedPartWidth = part.width * scale;
      const centerX = cursorX + fittedPartWidth / 2;
      part.numeratorText?.setScale(scale);
      part.denominatorText?.setScale(scale);
      part.numeratorText?.setPosition(centerX, numeratorY);
      part.denominatorText?.setPosition(centerX, denominatorY);
      lineGraphics.lineBetween(
        cursorX + fractionPadding * scale,
        lineY,
        cursorX + fittedPartWidth - fractionPadding * scale,
        lineY,
      );

      if (part.slot) {
        const slotY = part.slot === 'numerator' ? numeratorY : denominatorY;
        this.drawAnswerBox(centerX - fittedSlotWidth / 2, slotY, fittedSlotWidth, fittedSlotHeight);
        this.answerText.setPosition(centerX, slotY);
      }

      cursorX += fittedPartWidth;
    });
  }

  /** 指定された分数のどこが答え欄になるかを、分子・分母・なしで返します。 */
  private getFractionAnswerSlot(part: 'left' | 'right' | 'result'): 'numerator' | 'denominator' | null {
    if (this.problem.answerSlot === part) {
      return 'numerator';
    }

    if (this.problem.answerSlot === `${part}Denominator`) {
      return 'denominator';
    }

    return null;
  }

  /** 分数式の間に入る演算子や等号などの文字部品を作ります。 */
  private createFractionInlineText(
    text: string,
    y: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Extract<FractionEquationPart, { kind: 'text' }> {
    const textPart = this.scene.add.text(0, y, text, style).setOrigin(0, 0.5);
    this.equationContainer.add(textPart);
    return { kind: 'text', width: textPart.width, text: textPart };
  }

  /** 分数一つぶんの部品を作り、空欄ではない分子・分母だけを文字で用意します。 */
  private createFractionEquationPart(
    numerator: number,
    denominator: number,
    slot: 'numerator' | 'denominator' | null,
    numeratorY: number,
    denominatorY: number,
    slotWidth: number,
    padding: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Extract<FractionEquationPart, { kind: 'fraction' }> {
    const numeratorText = slot === 'numerator'
      ? null
      : this.scene.add.text(0, numeratorY, String(numerator), style).setOrigin(0.5);
    const denominatorText = slot === 'denominator'
      ? null
      : this.scene.add.text(0, denominatorY, String(denominator), style).setOrigin(0.5);
    const numeratorWidth = numeratorText?.width ?? slotWidth;
    const denominatorWidth = denominatorText?.width ?? slotWidth;
    const fractionWidth = Math.max(numeratorWidth, denominatorWidth, 34) + padding * 2;

    if (numeratorText) {
      this.equationContainer.add(numeratorText);
    }
    if (denominatorText) {
      this.equationContainer.add(denominatorText);
    }

    return {
      kind: 'fraction',
      width: fractionWidth,
      slot,
      numeratorText,
      denominatorText,
    };
  }

  /** 入力欄の見た目を描き直します。式の穴の位置が変わるたびに呼ばれます。 */
  private drawAnswerBox(x: number, y: number, width: number, height: number): void {
    const top = y - height / 2;
    this.answerBox.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    this.answerBox.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    this.answerBox.fillRoundedRect(x, top, width, height, 14);
    this.answerBox.strokeRoundedRect(x, top, width, height, 14);
  }

  /** 二枠回答の後半用テキストがなければ作ります。すでにある場合は再利用します。 */
  private ensureRemainderAnswerText(): void {
    if (this.remainderAnswerText) {
      return;
    }

    this.remainderAnswerText = this.scene.add
      .text(CAPTURE_LAYOUT.answerText.x, CAPTURE_LAYOUT.answerText.y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  /** 二枠回答を使わない問題に戻すため、後半用テキストと位置情報を消します。 */
  private clearRemainderAnswerText(): void {
    this.remainderAnswerText?.destroy();
    this.remainderAnswerText = undefined;
    this.quotientAnswerBounds = null;
    this.remainderAnswerBounds = null;
    this.activeAnswerBox.clear();
    this.answerText.setColor(COLORS.ink);
  }

  /** 二枠回答で、今入力している欄だけ青い枠で目立たせます。 */
  private drawActiveAnswerHighlight(): void {
    this.activeAnswerBox.clear();
    if (!usesTwoPartAnswer(this.problem)) {
      return;
    }

    const bounds = this.input.activePart === 'quotient'
      ? this.quotientAnswerBounds
      : this.remainderAnswerBounds;
    if (!bounds) {
      return;
    }

    const top = bounds.y - bounds.height / 2;
    this.activeAnswerBox.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.blue).color, 0.95);
    this.activeAnswerBox.strokeRoundedRect(bounds.x, top, bounds.width, bounds.height, 14);
  }

  /** 入力中の文字を答え欄へ反映し、二枠回答や時計表示の見た目も整えます。 */
  updateAnswerText(input: CaptureAnswerDisplayState = this.input): void {
    this.input = input;
    if (usesPlaceValueAnswer(this.problem)) {
      this.updatePlaceValueAnswer();
      return;
    }
    if (isGridExpressionProblem(this.problem)) {
      this.answerText.setText('');
      this.gridProblemAnswerText?.setText(this.input.first.length > 0 ? `こたえ ${this.input.first}` : 'こたえをいれよう');
      return;
    }

    if (usesChoiceAnswer(this.problem)) {
      if (usesMultiSelectChoiceAnswer(this.problem) || this.problem.answerMode === 'choiceColumn') {
        this.answerText.setText('');
        return;
      }

      this.answerText.setText(this.input.selectedChoiceLabel ?? '');
      return;
    }

    if (usesTwoPartAnswer(this.problem)) {
      this.answerText.setText(this.input.first);
      this.remainderAnswerText?.setText(this.input.second);
      this.answerText.setColor(this.input.activePart === 'quotient' ? COLORS.blue : COLORS.ink);
      this.remainderAnswerText?.setColor(this.input.activePart === 'remainder' ? COLORS.blue : COLORS.ink);
      this.drawActiveAnswerHighlight();
      return;
    }

    if (
      isClockTimeProblem(this.problem)
      && this.problem.answerSlot === 'result'
      && this.problem.right !== 0
      && this.input.first.length >= 3
    ) {
      this.answerText.setText(this.formatClockAnswerInput(this.input.first));
      return;
    }

    this.answerText.setText(this.input.first);
  }

  /** 時計の答え入力を、時刻として読める場合だけ「時」「分」つきに整えます。 */
  private formatClockAnswerInput(input: string): string {
    const value = Number(input);
    if (!Number.isInteger(value)) {
      return input;
    }

    const minute = value % 100;
    const hour = Math.floor(value / 100);
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return input;
    }

    return `${hour}時${minute}分`;
  }
}
