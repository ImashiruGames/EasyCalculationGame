import * as Phaser from 'phaser';
import { getMonsterById, getStageMonsterEncounterRate } from '../../../data/monsters';
import { SHOP_ITEM_IDS } from '../../../data/shopItems';
import { getStageById } from '../../../data/stages';
import {
  addCapture,
  consumeShopItem,
  getItemCount,
  getMonsterCaptureCount,
  getMonsterFragmentCount,
  loadSaveState,
  recordStageAverageAnswerTime,
} from '../../../state/save';
import { playButtonTapSound, playCaptureFeedback, playCorrectSound, playWrongAnswerSound } from '../../audio';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { APP_LAYOUT } from '../../layoutConfig';
import {
  createProblemAvoiding,
  formatSquareRootSquaredBase,
  formatProblem,
  formatProblemAnswer,
  getProblemAnswerPairJudgement,
  isClockMinuteConversionProblem,
  isClockTimeProblem,
  isDecimalProblem,
  isFractionProblem,
  isMissingDigitArithmeticProblem,
  isProblemAnswerCorrect,
  isShapeAreaProblem,
  isSquareRootProblem,
  isVerticalArithmeticProblem,
  usesChoiceAnswer,
  usesClockMinuteConversionPairAnswer,
  usesMultiSelectChoiceAnswer,
  usesOptionalSquareRootCoefficientInput,
  usesSquareRootComparisonAnswer,
  usesSquareRootDecimalValueAnswer,
  usesSquareRootExpressionAnswer,
  usesSquareRootFractionAnswer,
  usesSquareRootPairAnswer,
  usesSquareRootRationalizeAnswer,
  usesSquareRootSimplifyAnswer,
  usesTwoPartAnswer,
  usesQuotientRemainderAnswer,
} from '../../problem/mathProblems';
import { SceneKeys } from '../../sceneKeys';
import { getAnswerSpeedBonus } from '../../problem/speedBonus';
import { CaptureSceneData, ConfigurableProblemRule, MathProblem, MonsterDefinition, SquareRootComparisonTerm, StageDefinition, StageId } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { showGameMenu } from '../../ui/common/gameMenu';
import { createCaptureBall, getCaptureBallTexture } from '../../ui/capture/captureBall';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { drawNumberKeypad, NumberKeypadLabel, resolveNumberKeyInput } from '../../ui/problem/numberKeypad';
import { startStageBgm } from '../../bgm';
import { getCaptureGaugeGain } from '../../captureGauge';
import { showRankUpOverlayIfNeeded } from '../../ui/achievements/rankUpOverlay';
import { drawCaptureReadabilityPanel, drawStageBackdrop } from '../../ui/stage/stageBackdrop';
import { preloadMonsterEvolutionLineImageAssetsByIds } from '../../assets/monsterImageAssets';
import { preloadStageBackgroundAsset } from '../../assets/stageBackgroundAssets';

const CAPTURE_LAYOUT = APP_LAYOUT.captureGame;
type RareEncounterIntro = 'none' | 'rare' | 'superRare';
type DivisionAnswerPart = 'quotient' | 'remainder';
interface ChoiceAnswerOption {
  id: string;
  label: string;
  value: number;
  isCorrect: boolean;
}
interface ChoiceExpression {
  label: string;
  value: number;
}
interface ChoiceAnswerCard {
  option: ChoiceAnswerOption;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  width: number;
  height: number;
}
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

const FORMULA_HORIZONTAL_MARGIN = 16;
const ROOT_RADICAL_CONTENT_OFFSET = 30;

export class CaptureGameScene extends Phaser.Scene {
  private stageId: StageId = 'g1-tashizan-hazimarinosougen';
  private monsterId = 'picoleaf';
  private stage!: StageDefinition;
  private monster!: MonsterDefinition;
  private problem!: MathProblem;
  private answerInput = '';
  private remainderAnswerInput = '';
  private activeDivisionAnswerPart: DivisionAnswerPart = 'quotient';
  private progress = 0;
  private isBusy = false;
  private equationContainer!: Phaser.GameObjects.Container;
  private answerBox!: Phaser.GameObjects.Graphics;
  private activeAnswerBox!: Phaser.GameObjects.Graphics;
  private answerText!: Phaser.GameObjects.Text;
  private remainderAnswerText?: Phaser.GameObjects.Text;
  private quotientAnswerBounds: AnswerSlotBounds | null = null;
  private remainderAnswerBounds: AnswerSlotBounds | null = null;
  private feedbackText!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressBall!: Phaser.GameObjects.Image;
  private progressTween?: Phaser.Tweens.Tween;
  private captureItemText!: Phaser.GameObjects.Text;
  private gaugeBallActive = false;
  private gaugeBallAvailable = false;
  private gaugeBallChecked = false;
  private monsterCenter = new Phaser.Math.Vector2(CAPTURE_LAYOUT.monsterCenter.x, CAPTURE_LAYOUT.monsterCenter.y);
  private monsterVisual!: Phaser.GameObjects.Image;
  private problemStartedAt = 0;
  private correctAnswerElapsedMsTotal = 0;
  private correctAnswerCount = 0;
  private hasStageBackground = false;
  private rareEncounterIntro: RareEncounterIntro = 'none';
  private choiceControlsContainer!: Phaser.GameObjects.Container;
  private choiceOptions: ChoiceAnswerOption[] = [];
  private selectedChoiceIds = new Set<string>();
  private choiceCards: ChoiceAnswerCard[] = [];

  /** Phaserにこの画面のSceneキーを渡して、捕獲ゲーム画面として登録します。 */
  constructor() {
    super(SceneKeys.CaptureGame);
  }

  /** ステージ開始時の受け取り値をもとに、対象ステージ・モンスター・入力状態を初期化します。 */
  init(data?: CaptureSceneData): void {
    this.stageId = data?.stageId ?? 'g1-tashizan-hazimarinosougen';
    this.monsterId = data?.monsterId ?? 'picoleaf';
    this.stage = getStageById(this.stageId);
    this.monster = getMonsterById(this.monsterId);
    this.answerInput = '';
    this.remainderAnswerInput = '';
    this.activeDivisionAnswerPart = 'quotient';
    this.remainderAnswerText = undefined;
    this.quotientAnswerBounds = null;
    this.remainderAnswerBounds = null;
    this.progress = 0;
    this.isBusy = true;
    this.progressTween = undefined;
    this.correctAnswerElapsedMsTotal = 0;
    this.correctAnswerCount = 0;
    this.gaugeBallActive = false;
    this.gaugeBallAvailable = false;
    this.gaugeBallChecked = false;
    this.rareEncounterIntro = this.getRareEncounterIntro();
    this.choiceOptions = [];
    this.selectedChoiceIds.clear();
    this.choiceCards = [];
  }

  /** 背景やモンスター画像など、この捕獲画面で使う素材を事前に読み込みます。 */
  preload(): void {
    preloadStageBackgroundAsset(this, this.stageId);
    preloadMonsterEvolutionLineImageAssetsByIds(this, [this.monsterId]);
  }

  /** 画面の土台を作り、登場演出から最初の問題へ進めます。 */
  create(): void {
    startStageBgm(this.stageId);
    this.cameras.main.setBackgroundColor('#fffaf0');
    this.hasStageBackground = drawStageBackdrop(this, this.stageId);
    if (this.hasStageBackground) {
      drawCaptureReadabilityPanel(this);
    }
    this.drawHeader();
    this.drawMonsterArea();
    this.drawProblemArea();
    if (!this.stageUsesChoiceControls()) {
      this.drawKeypad();
    }
    this.startEncounterIntro();
  }

  /** 戻る・メニュー・ステージ名を上部に配置します。 */
  private drawHeader(): void {
    createSmallButton(
      this,
      CAPTURE_LAYOUT.headerBackButton.x,
      CAPTURE_LAYOUT.headerBackButton.y,
      '←',
      () => this.scene.start(SceneKeys.StageIntro, { stageId: this.stageId }),
    );
    createSmallButton(
      this,
      CAPTURE_LAYOUT.headerMenuButton.x,
      CAPTURE_LAYOUT.headerMenuButton.y,
      '≡',
      () => showGameMenu(this),
    );

    this.add
      .text(CAPTURE_LAYOUT.headerTitle.x, CAPTURE_LAYOUT.headerTitle.y, this.stage.name, {
        fontFamily: FONT_FAMILY,
        fontSize: `${this.getNameLineFontSize(this.stage.name, 18, 16, 14)}px`,
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: CAPTURE_LAYOUT.headerTitle.wrapWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  /** 長いステージ名が見切れないよう、文字数に応じて見出しの文字サイズを選びます。 */
  private getNameLineFontSize(text: string, large: number, medium: number, small: number): number {
    if (text.length >= 12) {
      return small;
    }

    if (text.length >= 8) {
      return medium;
    }

    return large;
  }

  /** モンスター、アイテム残数、捕獲ゲージをまとめて描画します。 */
  private drawMonsterArea(): void {
    const panel = this.add.graphics();
    const fillColor = this.hasStageBackground ? COLORS.panel : this.monster.palette.background;
    const fillAlpha = this.hasStageBackground ? 0.64 : 1;
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(fillColor).color, fillAlpha);
    panel.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    const monsterPanel = CAPTURE_LAYOUT.monsterPanel;
    panel.fillRoundedRect(
      monsterPanel.x,
      monsterPanel.y,
      monsterPanel.width,
      monsterPanel.height,
      monsterPanel.radius,
    );
    panel.strokeRoundedRect(
      monsterPanel.x,
      monsterPanel.y,
      monsterPanel.width,
      monsterPanel.height,
      monsterPanel.radius,
    );

    this.monsterVisual = createMonsterVisual(
      this,
      this.monster,
      this.monsterCenter.x,
      this.monsterCenter.y,
      CAPTURE_LAYOUT.monsterSize,
    );

    this.add
      .text(CAPTURE_LAYOUT.monsterName.x, CAPTURE_LAYOUT.monsterName.y, this.monster.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);

    const gaugeBallCount = getItemCount(loadSaveState(), SHOP_ITEM_IDS.gaugeBall);
    this.gaugeBallAvailable = gaugeBallCount > 0;
    this.captureItemText = this.add
      .text(CAPTURE_LAYOUT.itemText.x, CAPTURE_LAYOUT.itemText.y, gaugeBallCount > 0 ? `ボール ${gaugeBallCount}` : 'アイテムなし', {
        fontFamily: FONT_FAMILY,
        fontSize: gaugeBallCount > 0 ? '13px' : '12px',
        fontStyle: '800',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add.rectangle(
      GAME_WIDTH / 2,
      CAPTURE_LAYOUT.progressBar.y,
      CAPTURE_LAYOUT.progressBar.width,
      CAPTURE_LAYOUT.progressBar.height,
      Phaser.Display.Color.HexStringToColor('#d8e0e8').color,
      1,
    );
    this.progressFill = this.add
      .rectangle(
        CAPTURE_LAYOUT.progressBar.x,
        CAPTURE_LAYOUT.progressBar.y,
        1,
        CAPTURE_LAYOUT.progressBar.height,
        Phaser.Display.Color.HexStringToColor(this.stage.accentColor).color,
        1,
      )
      .setOrigin(0, 0.5);
    this.drawProgressGoalMarker();
    this.progressBall = createCaptureBall(
      this,
      CAPTURE_LAYOUT.progressBar.x,
      CAPTURE_LAYOUT.progressBar.y,
      CAPTURE_LAYOUT.progressBar.ballRadius,
      this.getCurrentBallVariant(),
    ).setDepth(2);
    this.updateProgressBar();
  }

  /** 捕獲ゲージの終点に、ここまで届くと捕獲できることを示すゴールリングを置きます。 */
  private drawProgressGoalMarker(): void {
    const goalX = CAPTURE_LAYOUT.progressBar.x + CAPTURE_LAYOUT.progressBar.width;
    const goalY = CAPTURE_LAYOUT.progressBar.y;
    const marker = this.add.graphics().setDepth(1);
    const yellow = Phaser.Display.Color.HexStringToColor(COLORS.yellow).color;
    const panel = Phaser.Display.Color.HexStringToColor(COLORS.panel).color;
    const line = Phaser.Display.Color.HexStringToColor(COLORS.line).color;

    marker.fillStyle(yellow, 0.34);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      marker.fillTriangle(
        goalX + Math.cos(angle - 0.12) * 12,
        goalY + Math.sin(angle - 0.12) * 12,
        goalX + Math.cos(angle) * 18,
        goalY + Math.sin(angle) * 18,
        goalX + Math.cos(angle + 0.12) * 12,
        goalY + Math.sin(angle + 0.12) * 12,
      );
    }

    marker.lineStyle(4, yellow, 1);
    marker.strokeCircle(goalX, goalY, 16);
    marker.fillStyle(panel, 1);
    marker.fillCircle(goalX, goalY, 8);
    marker.lineStyle(2, line, 1);
    marker.strokeCircle(goalX, goalY, 8);

    marker.fillStyle(yellow, 1);
    this.drawGoalStar(marker, goalX, goalY, 8, 3.8);
  }

  /** ゴールリング中央の星を、外側と内側の半径を交互に使って描きます。 */
  private drawGoalStar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    outerRadius: number,
    innerRadius: number,
  ): void {
    graphics.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + (Math.PI * index) / 5;
      const pointX = x + Math.cos(angle) * radius;
      const pointY = y + Math.sin(angle) * radius;
      if (index === 0) {
        graphics.moveTo(pointX, pointY);
        continue;
      }

      graphics.lineTo(pointX, pointY);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  /** 式、答え欄、フィードバック文の表示先を用意します。 */
  private drawProblemArea(): void {
    this.answerBox = this.add.graphics();
    this.activeAnswerBox = this.add.graphics();
    this.equationContainer = this.add.container(0, 0);

    this.answerText = this.add
      .text(CAPTURE_LAYOUT.answerText.x, CAPTURE_LAYOUT.answerText.y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '34px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    this.feedbackText = this.add
      .text(CAPTURE_LAYOUT.feedbackText.x, CAPTURE_LAYOUT.feedbackText.y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.grassDark,
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: 330, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.choiceControlsContainer = this.add.container(0, 0);
  }

  /** ステージ内容に合わせて小数点つき/なしのテンキーを作ります。 */
  private drawKeypad(): void {
    drawNumberKeypad(this, {
      ...CAPTURE_LAYOUT.keypad,
      allowDecimalPoint: this.stageUsesDecimalKeypad(),
      onKey: (label) => this.handleKey(label),
    });
  }

  /** ステージの問題ルールに小数問題が含まれるかを見て、小数点ボタンの有無を決めます。 */
  private stageUsesDecimalKeypad(): boolean {
    const problemRule = this.stage.problemRule;
    if (typeof problemRule === 'string') {
      return false;
    }

    return Array.isArray(problemRule)
      ? problemRule.some((rule) => this.problemRuleUsesDecimalKeypad(rule))
      : this.problemRuleUsesDecimalKeypad(problemRule);
  }

  /** 問題ルールが小数点入力を必要とするかを判定します。 */
  private problemRuleUsesDecimalKeypad(rule: Exclude<StageDefinition['problemRule'], string | Array<unknown>>): boolean {
    return rule.kind === 'decimal' || (rule.kind === 'squareRoot' && rule.rootMode === 'decimalValue');
  }

  /** ステージ内に選択式ルールがあるかを見て、テンキーの代わりに選択カードを使うか決めます。 */
  private stageUsesChoiceControls(): boolean {
    const problemRule = this.stage.problemRule;
    if (typeof problemRule === 'string') {
      return false;
    }

    return Array.isArray(problemRule)
      ? problemRule.some((rule) => this.problemRuleUsesChoiceControls(rule))
      : this.problemRuleUsesChoiceControls(problemRule);
  }

  /** 問題ルールのanswerModeが選択カード用かを判定します。 */
  private problemRuleUsesChoiceControls(rule: ConfigurableProblemRule): boolean {
    return rule.answerMode === 'choiceGrid'
      || rule.answerMode === 'choiceRow'
      || rule.answerMode === 'choiceColumn'
      || rule.answerMode === 'multiSelect';
  }

  /** 選択式問題用のカードと、選んでから答えるためのボタンを描画します。 */
  private renderChoiceControls(): void {
    this.clearChoiceControls();
    if (!usesChoiceAnswer(this.problem)) {
      return;
    }

    this.choiceOptions = this.createChoiceOptionsForProblem();
    const layout = this.getChoiceCardLayout();
    this.choiceOptions.forEach((option, index) => {
      const position = layout.positions[index];
      if (!position) {
        return;
      }

      const card = this.createChoiceCard(option, position.x, position.y, layout.width, layout.height);
      this.choiceCards.push(card);
    });

    if (usesMultiSelectChoiceAnswer(this.problem)) {
      const clearButton = createButton(this, {
        x: 126,
        y: 674,
        width: 118,
        height: 56,
        label: 'けす',
        fontSize: 20,
        fillColor: COLORS.panel,
        onClick: () => this.clearChoiceSelection(),
      });
      this.choiceControlsContainer.add(clearButton);
    }

    const submitButton = createButton(this, {
      x: usesMultiSelectChoiceAnswer(this.problem) ? 264 : GAME_WIDTH / 2,
      y: 674,
      width: usesMultiSelectChoiceAnswer(this.problem) ? 132 : 172,
      height: 56,
      label: 'こたえる',
      fontSize: 20,
      fillColor: COLORS.yellow,
      onClick: () => this.submitChoiceAnswer(),
    });
    this.choiceControlsContainer.add(submitButton);
  }

  /** 選択式カードの表示位置を、2×2・横1列・縦4枚の指定に合わせて返します。 */
  private getChoiceCardLayout(): { width: number; height: number; positions: Array<{ x: number; y: number }> } {
    if (this.problem.answerMode === 'choiceRow') {
      return {
        width: 78,
        height: 66,
        positions: [
          { x: 54, y: 512 },
          { x: 148, y: 512 },
          { x: 242, y: 512 },
          { x: 336, y: 512 },
        ],
      };
    }

    if (this.problem.answerMode === 'choiceColumn') {
      return {
        width: 286,
        height: 52,
        positions: [
          { x: GAME_WIDTH / 2, y: 412 },
          { x: GAME_WIDTH / 2, y: 472 },
          { x: GAME_WIDTH / 2, y: 532 },
          { x: GAME_WIDTH / 2, y: 592 },
        ],
      };
    }

    return {
      width: 138,
      height: 66,
      positions: [
        { x: 118, y: 456 },
        { x: 272, y: 456 },
        { x: 118, y: 536 },
        { x: 272, y: 536 },
      ],
    };
  }

  /** 選択式カードや決定ボタンを消し、次の問題用に描き直せる状態へ戻します。 */
  private clearChoiceControls(): void {
    this.choiceControlsContainer.removeAll(true);
    this.choiceCards = [];
  }

  /** 選択式カードを1つ作り、タップ時に選択状態を切り替えます。 */
  private createChoiceCard(
    option: ChoiceAnswerOption,
    x: number,
    y: number,
    width: number,
    height: number,
  ): ChoiceAnswerCard {
    const container = this.add.container(x, y);
    const background = this.add.graphics();
    const label = this.add
      .text(0, 0, option.label, {
        fontFamily: FONT_FAMILY,
        fontSize: `${this.getChoiceCardFontSize(option.label, width)}px`,
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: width - 18, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const hitZone = this.add
      .zone(0, 0, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const card: ChoiceAnswerCard = { option, container, background, width, height };

    hitZone.on('pointerdown', () => {
      playButtonTapSound();
      this.selectChoiceOption(option.id);
    });
    container.add([background, label, hitZone]);
    this.choiceControlsContainer.add(container);
    this.redrawChoiceCard(card);
    return card;
  }

  /** カード幅と文字数に合わせて、選択肢ラベルの読みやすい文字サイズを返します。 */
  private getChoiceCardFontSize(label: string, width: number): number {
    if (width >= 220) {
      return label.length >= 9 ? 24 : 28;
    }

    return label.length >= 5 ? 22 : 28;
  }

  /** 選択中かどうかに合わせて、カードの色と枠線を描き直します。 */
  private redrawChoiceCard(card: ChoiceAnswerCard): void {
    const selected = this.selectedChoiceIds.has(card.option.id);
    const fillColor = selected ? '#dff2ff' : COLORS.panel;
    const strokeColor = selected ? COLORS.blue : COLORS.line;
    const strokeWidth = selected ? 5 : 3;

    card.background.clear();
    card.background.fillStyle(Phaser.Display.Color.HexStringToColor(fillColor).color, 1);
    card.background.lineStyle(strokeWidth, Phaser.Display.Color.HexStringToColor(strokeColor).color, 1);
    card.background.fillRoundedRect(-card.width / 2, -card.height / 2, card.width, card.height, 14);
    card.background.strokeRoundedRect(-card.width / 2, -card.height / 2, card.width, card.height, 14);
  }

  /** すべての選択式カードを、現在の選択状態に合わせて更新します。 */
  private updateChoiceCards(): void {
    this.choiceCards.forEach((card) => this.redrawChoiceCard(card));
  }

  /** カードを選択します。4択は1つだけ、全て選べは複数選択を許可します。 */
  private selectChoiceOption(optionId: string): void {
    if (this.isBusy) {
      return;
    }

    if (usesMultiSelectChoiceAnswer(this.problem)) {
      if (this.selectedChoiceIds.has(optionId)) {
        this.selectedChoiceIds.delete(optionId);
      } else {
        this.selectedChoiceIds.add(optionId);
      }
    } else {
      this.selectedChoiceIds.clear();
      this.selectedChoiceIds.add(optionId);
    }

    this.updateChoiceCards();
    this.updateAnswerText();
  }

  /** 全て選べ問題で、いま選んでいるカードをまとめて外します。 */
  private clearChoiceSelection(): void {
    if (this.isBusy || !usesMultiSelectChoiceAnswer(this.problem)) {
      return;
    }

    this.selectedChoiceIds.clear();
    this.updateChoiceCards();
    this.updateAnswerText();
  }

  /** 今のanswerModeに合わせて、数字カード・式カード・全て選べカードを作り分けます。 */
  private createChoiceOptionsForProblem(): ChoiceAnswerOption[] {
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
    const decimalPlaces = this.getAnswerDecimalPlaces();
    const scale = 10 ** decimalPlaces;
    return Math.round(value * scale) / scale;
  }

  /** 選択肢を1ずつずらすか、小数の最小単位でずらすかを返します。 */
  private getChoiceValueStep(): number {
    const decimalPlaces = this.getAnswerDecimalPlaces();
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
    const decimalPlaces = this.getAnswerDecimalPlaces();
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
    return Phaser.Utils.Array.Shuffle([...items]);
  }

  /** 選択済みカードを実体の配列として返します。 */
  private getSelectedChoiceOptions(): ChoiceAnswerOption[] {
    return this.choiceOptions.filter((option) => this.selectedChoiceIds.has(option.id));
  }

  /** 正解カードを実体の配列として返します。 */
  private getCorrectChoiceOptions(): ChoiceAnswerOption[] {
    return this.choiceOptions.filter((option) => option.isCorrect);
  }

  /** 選択式の選択状態を採点し、単一選択と複数選択をそれぞれ判定します。 */
  private isChoiceSelectionCorrect(): boolean {
    const selectedOptions = this.getSelectedChoiceOptions();
    if (!usesMultiSelectChoiceAnswer(this.problem)) {
      return selectedOptions.length === 1 && selectedOptions[0].isCorrect;
    }

    const correctOptions = this.getCorrectChoiceOptions();
    return selectedOptions.length === correctOptions.length
      && selectedOptions.every((option) => option.isCorrect);
  }

  /** 不正解時に見せる正解表示を、選択式の種類に合わせて作ります。 */
  private getChoiceCorrectAnswerLabel(): string {
    if (this.problem.answerMode === 'choiceColumn') {
      const correctOption = this.getCorrectChoiceOptions()[0];
      return correctOption?.label ?? formatProblemAnswer(this.problem);
    }

    if (!usesMultiSelectChoiceAnswer(this.problem)) {
      return formatProblemAnswer(this.problem);
    }

    const labels = this.getCorrectChoiceOptions().map((option) => option.label);
    return labels.length > 0 ? labels.join('、') : formatProblemAnswer(this.problem);
  }

  /** 選択式の回答を採点し、正解なら通常の正解処理、不正解なら正解を表示します。 */
  private submitChoiceAnswer(): void {
    if (this.isBusy || this.selectedChoiceIds.size === 0) {
      return;
    }

    this.isBusy = true;
    if (this.isChoiceSelectionCorrect()) {
      this.handleCorrectAnswer();
      return;
    }

    this.feedbackText.setColor(COLORS.red);
    this.feedbackText.setText(`こたえは ${this.getChoiceCorrectAnswerLabel()}`);
    playWrongAnswerSound();
    this.time.delayedCall(1500, () => this.showNextProblem());
  }

  /** テンキー入力を受け、通常の一枠回答なら入力更新か採点へ進めます。 */
  private handleKey(label: NumberKeypadLabel): void {
    if (this.isBusy) {
      return;
    }

    if (usesChoiceAnswer(this.problem)) {
      return;
    }

    if (this.usesTwoPartAnswer()) {
      this.handleTwoPartAnswerKey(label);
      return;
    }

    const answerDecimalPlaces = this.getAnswerDecimalPlaces();
    const maxDigits = this.getSingleAnswerMaxDigits(answerDecimalPlaces);
    const result = resolveNumberKeyInput(label, this.answerInput, maxDigits, {
      allowDecimalPoint: answerDecimalPlaces > 0,
      decimalPlaces: answerDecimalPlaces,
    });
    if (result.type === 'submit') {
      this.submitAnswer();
      return;
    }

    if (result.type === 'input') {
      this.answerInput = result.value;
      this.updateAnswerText();
      return;
    }
  }

  /** あまり・√・時間分のような二枠回答で、前半入力から後半入力へ進めます。 */
  private handleTwoPartAnswerKey(label: NumberKeypadLabel): void {
    if (label === 'けす' && this.activeDivisionAnswerPart === 'remainder' && this.remainderAnswerInput.length === 0) {
      this.activeDivisionAnswerPart = 'quotient';
      this.updateAnswerText();
      return;
    }

    const currentInput = this.activeDivisionAnswerPart === 'quotient'
      ? this.answerInput
      : this.remainderAnswerInput;
    const result = resolveNumberKeyInput(label, currentInput, 2);
    if (result.type === 'submit') {
      const canSkipCoefficient = this.answerInput.length === 0
        && usesOptionalSquareRootCoefficientInput(this.problem);
      if (this.activeDivisionAnswerPart === 'quotient' && (this.answerInput.length > 0 || canSkipCoefficient)) {
        this.activeDivisionAnswerPart = 'remainder';
        this.updateAnswerText();
        return;
      }

      this.submitAnswer();
      return;
    }

    if (result.type === 'input') {
      if (this.activeDivisionAnswerPart === 'quotient') {
        this.answerInput = result.value;
      } else {
        this.remainderAnswerInput = result.value;
      }
      this.updateAnswerText();
    }
  }

  /** 今の問題で、小数入力が必要な場合の答えの小数けた数を返します。 */
  private getAnswerDecimalPlaces(): number {
    if (usesSquareRootDecimalValueAnswer(this.problem)) {
      return this.problem.resultDecimalPlaces ?? 3;
    }

    if (!isDecimalProblem(this.problem)) {
      return 0;
    }

    if (this.problem.answerSlot === 'left') {
      return this.problem.leftDecimalPlaces ?? 0;
    }
    if (this.problem.answerSlot === 'right') {
      return this.problem.rightDecimalPlaces ?? 0;
    }

    return this.problem.resultDecimalPlaces ?? 0;
  }

  /** Returns how many typed characters the current single answer needs. */
  private getSingleAnswerMaxDigits(answerDecimalPlaces = 0): number {
    if (answerDecimalPlaces > 0) {
      return 5 + answerDecimalPlaces;
    }

    if (isMissingDigitArithmeticProblem(this.problem)) {
      return 1;
    }

    if (
      isClockTimeProblem(this.problem)
      && this.problem.answerSlot === 'result'
      && this.problem.right !== 0
    ) {
      return 4;
    }

    const wholeNumberAnswer = Math.abs(Math.trunc(this.problem.answer));
    return Phaser.Math.Clamp(String(wholeNumberAnswer).length, 2, 4);
  }

  /** 今の問題が二つの入力欄を使う形式かどうかを判定します。 */
  private usesTwoPartAnswer(): boolean {
    return usesTwoPartAnswer(this.problem);
  }

  /** 捕獲画面に入った直後、登場メッセージとレア演出を出してからカウントダウンへ進みます。 */
  private startEncounterIntro(): void {
    const overlay = this.add.container(0, 0).setDepth(12);
    const inputBlocker = this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0.5)
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.97);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(this.stage.accentColor).color, 1);
    const encounterPanel = CAPTURE_LAYOUT.encounterPanel;
    panel.fillRoundedRect(
      encounterPanel.x,
      encounterPanel.y,
      encounterPanel.width,
      encounterPanel.height,
      encounterPanel.radius,
    );
    panel.strokeRoundedRect(
      encounterPanel.x,
      encounterPanel.y,
      encounterPanel.width,
      encounterPanel.height,
      encounterPanel.radius,
    );

    const message = this.add
      .text(CAPTURE_LAYOUT.encounterMessage.x, CAPTURE_LAYOUT.encounterMessage.y, `${this.monster.name}が\nあらわれた！`, {
        fontFamily: FONT_FAMILY,
        fontSize: `${this.getNameLineFontSize(this.monster.name, 28, 25, 22)}px`,
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: CAPTURE_LAYOUT.encounterMessage.wrapWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    overlay.add([inputBlocker, panel, message]);
    if (this.rareEncounterIntro === 'superRare') {
      this.drawRainbowEncounterFrame(overlay);
    }
    if (this.rareEncounterIntro !== 'none') {
      this.drawRareEncounterSparkle(overlay);
    }
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 180, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: this.monsterVisual,
      scale: { from: 0.78, to: 1 },
      y: { from: this.monsterCenter.y + 10, to: this.monsterCenter.y },
      duration: 360,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(1150, () => {
      this.runStartCountdown(overlay, panel, message);
    });
  }

  /** 未捕獲のレアモンスターなら、出現率に応じた登場演出の強さを決めます。 */
  private getRareEncounterIntro(): RareEncounterIntro {
    const saveState = loadSaveState();
    if (!this.monster.isRare || getMonsterCaptureCount(saveState, this.monster.id) > 0) {
      return 'none';
    }

    const encounterRate = getStageMonsterEncounterRate(this.stage.monsterIds, this.monster.id);
    if (encounterRate <= 0.01) {
      return 'superRare';
    }

    if (encounterRate <= 0.05) {
      return 'rare';
    }

    return 'none';
  }

  /** 超レア登場時の虹色フレームを重ね、ゆっくり点滅させます。 */
  private drawRainbowEncounterFrame(overlay: Phaser.GameObjects.Container): void {
    const rainbow = this.add.graphics();
    const colors = ['#ff5c8a', '#ffb347', '#fff275', '#7ee081', '#70c7ff', '#b9a7ff'];
    const encounterPanel = CAPTURE_LAYOUT.encounterPanel;
    colors.forEach((color, index) => {
      rainbow.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 0.92);
      rainbow.strokeRoundedRect(
        encounterPanel.x - index,
        encounterPanel.y - index,
        encounterPanel.width + index * 2,
        encounterPanel.height + index * 2,
        encounterPanel.radius + index,
      );
    });
    overlay.add(rainbow);
    this.tweens.add({
      targets: rainbow,
      alpha: { from: 0.62, to: 1 },
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** レア登場時の光輪と星を重ね、モンスターの周りを目立たせます。 */
  private drawRareEncounterSparkle(overlay: Phaser.GameObjects.Container): void {
    const glow = this.add.graphics();
    const glowColor = this.rareEncounterIntro === 'superRare' ? COLORS.yellow : COLORS.panel;
    glow.lineStyle(
      this.rareEncounterIntro === 'superRare' ? 5 : 4,
      Phaser.Display.Color.HexStringToColor(glowColor).color,
      this.rareEncounterIntro === 'superRare' ? 0.78 : 0.6,
    );
    glow.strokeCircle(this.monsterCenter.x, this.monsterCenter.y, CAPTURE_LAYOUT.rareGlowRadii.inner);
    glow.lineStyle(2, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 0.7);
    glow.strokeCircle(this.monsterCenter.x, this.monsterCenter.y, CAPTURE_LAYOUT.rareGlowRadii.outer);
    overlay.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.48, to: 0.92 },
      duration: 560,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    [
      { dx: -76, dy: -58, delay: 0 },
      { dx: 76, dy: -52, delay: 130 },
      { dx: -88, dy: 20, delay: 250 },
      { dx: 86, dy: 28, delay: 380 },
      { dx: 0, dy: -86, delay: 500 },
    ].forEach((sparkle) => {
      const star = this.add
        .text(this.monsterCenter.x + sparkle.dx, this.monsterCenter.y + sparkle.dy, '✦', {
          fontFamily: FONT_FAMILY,
          fontSize: this.rareEncounterIntro === 'superRare' ? '22px' : '18px',
          fontStyle: '900',
          color: COLORS.yellow,
        })
        .setOrigin(0.5);
      overlay.add(star);
      this.tweens.add({
        targets: star,
        scale: { from: 0.62, to: 1.28 },
        alpha: { from: 0.36, to: 1 },
        angle: { from: -10, to: 12 },
        duration: 620,
        yoyo: true,
        repeat: -1,
        delay: sparkle.delay,
        ease: 'Sine.easeInOut',
      });
    });
  }

  /** 3,2,1,GO! を同じメッセージ枠で見せ、終わったら最初の問題を表示します。 */
  private runStartCountdown(
    overlay: Phaser.GameObjects.Container,
    panel: Phaser.GameObjects.Graphics,
    message: Phaser.GameObjects.Text,
  ): void {
    const labels = ['3', '2', '1', 'GO!'];
    let index = 0;
    panel.clear();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 0.97);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(this.stage.accentColor).color, 1);
    const countdownPanel = CAPTURE_LAYOUT.countdownPanel;
    panel.fillRoundedRect(
      countdownPanel.x,
      countdownPanel.y,
      countdownPanel.width,
      countdownPanel.height,
      countdownPanel.radius,
    );
    panel.strokeRoundedRect(
      countdownPanel.x,
      countdownPanel.y,
      countdownPanel.width,
      countdownPanel.height,
      countdownPanel.radius,
    );
    message.setY(CAPTURE_LAYOUT.countdownMessageY);
    message.setFontSize(48);

    /** カウントダウンの次の文字を出し、最後まで進んだら問題開始へ切り替えます。 */
    const showNextLabel = (): void => {
      const label = labels[index];
      message.setText(label);
      message.setScale(0.74);
      this.tweens.add({
        targets: message,
        scale: 1,
        duration: 170,
        ease: 'Back.easeOut',
      });
      index += 1;

      if (index >= labels.length) {
        this.time.delayedCall(520, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 180,
            ease: 'Sine.easeIn',
            onComplete: () => {
              overlay.destroy(true);
              this.showNextProblem();
            },
          });
        });
        return;
      }

      this.time.delayedCall(520, showNextLabel);
    };

    showNextLabel();
  }

  /** 一枠回答を採点し、正解なら捕獲ゲージ、不正解なら答え表示から次問へ進めます。 */
  private submitAnswer(): void {
    if (usesChoiceAnswer(this.problem)) {
      this.submitChoiceAnswer();
      return;
    }

    if (this.usesTwoPartAnswer()) {
      this.submitTwoPartAnswer();
      return;
    }

    if (this.answerInput.length === 0) {
      return;
    }

    const submitted = Number(this.answerInput);
    this.isBusy = true;

    if (isProblemAnswerCorrect(this.problem, submitted)) {
      this.handleCorrectAnswer();
      return;
    }

    this.feedbackText.setColor(COLORS.red);
    this.feedbackText.setText(`こたえは ${formatProblemAnswer(this.problem)}`);
    playWrongAnswerSound();
    this.time.delayedCall(1500, () => this.showNextProblem());
  }

  /** 二枠回答を採点します。前半だけ入っている場合は後半欄へ移り、両方そろったら判定します。 */
  private submitTwoPartAnswer(): void {
    const allowsBlankCoefficient = usesOptionalSquareRootCoefficientInput(this.problem);
    if (this.answerInput.length === 0 && !allowsBlankCoefficient) {
      return;
    }
    if (this.remainderAnswerInput.length === 0) {
      this.activeDivisionAnswerPart = 'remainder';
      this.updateAnswerText();
      return;
    }

    const quotient = this.answerInput.length === 0 && allowsBlankCoefficient
      ? null
      : Number(this.answerInput);
    const remainder = Number(this.remainderAnswerInput);
    this.isBusy = true;

    const judgement = getProblemAnswerPairJudgement(this.problem, quotient, remainder);
    if (judgement === 'correct') {
      this.handleCorrectAnswer();
      return;
    }

    this.feedbackText.setColor(judgement === 'partial' ? COLORS.fire : COLORS.red);
    this.feedbackText.setText(`${judgement === 'partial' ? '△ ' : ''}こたえは ${formatProblemAnswer(this.problem)}`);
    playWrongAnswerSound();
    this.time.delayedCall(1500, () => this.showNextProblem());
  }

  /** 正解時の音、速度ボーナス、ゲージ加算、捕獲到達判定をまとめて処理します。 */
  private handleCorrectAnswer(): void {
    playCorrectSound();
    const answerElapsedMs = Math.max(0, this.time.now - this.problemStartedAt);
    this.correctAnswerElapsedMsTotal += answerElapsedMs;
    this.correctAnswerCount += 1;
    const speedBonus = getAnswerSpeedBonus(answerElapsedMs);
    const gaugeGain = this.getCorrectGaugeGain(speedBonus.multiplier);
    this.progress = Math.min(this.monster.goalGauge, this.progress + gaugeGain);
    this.feedbackText.setText('');
    this.showCorrectMark();
    this.updateProgressBar(true);

    if (this.progress >= this.monster.goalGauge) {
      this.time.delayedCall(450, () => this.showThrowOverlay());
      return;
    }

    this.time.delayedCall(450, () => this.showNextProblem());
  }

  /** 答え欄の位置に丸印を出し、正解した場所が分かるようにします。 */
  private showCorrectMark(): void {
    if (usesChoiceAnswer(this.problem)) {
      this.showChoiceCorrectMark();
      return;
    }

    const markX = this.remainderAnswerText
      ? (this.answerText.x + this.remainderAnswerText.x) / 2
      : this.answerText.x;
    const markY = this.answerText.y;
    const mark = this.add.container(markX, markY);
    const graphics = this.add.graphics();
    const markColor = Phaser.Display.Color.HexStringToColor(COLORS.grassDark).color;
    const targetWidth = this.remainderAnswerText
      ? Math.abs(this.remainderAnswerText.x - this.answerText.x) + 58
      : Math.max(this.answerText.width, this.answerText.height);
    const radius = Math.max(40, Math.min(96, targetWidth / 2 + 30));

    graphics.lineStyle(7, markColor, 0.92);
    graphics.strokeCircle(0, 0, radius);
    mark.add(graphics);
    mark.setScale(0.72);
    this.equationContainer.add(mark);
    this.tweens.add({
      targets: mark,
      scale: 1,
      alpha: { from: 0.45, to: 1 },
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  /** 選択式で正解したとき、選んだカードに丸印を重ねます。 */
  private showChoiceCorrectMark(): void {
    const selectedCards = this.choiceCards.filter((card) => this.selectedChoiceIds.has(card.option.id));
    selectedCards.forEach((card) => {
      const mark = this.add.graphics();
      const markColor = Phaser.Display.Color.HexStringToColor(COLORS.grassDark).color;
      mark.lineStyle(6, markColor, 0.92);
      mark.strokeRoundedRect(
        card.container.x - card.width / 2 + 7,
        card.container.y - card.height / 2 + 7,
        card.width - 14,
        card.height - 14,
        16,
      );
      this.choiceControlsContainer.add(mark);
    });
  }

  /** 前回と同じ問題を避けながら次の問題を作り、入力欄と表示をリセットします。 */
  private showNextProblem(): void {
    this.problem = createProblemAvoiding(this.stage.problemRule, this.problem);
    this.answerInput = '';
    this.remainderAnswerInput = '';
    this.activeDivisionAnswerPart = 'quotient';
    this.choiceOptions = [];
    this.selectedChoiceIds.clear();
    this.isBusy = false;
    this.renderProblem();
    this.renderChoiceControls();
    this.feedbackText.setText('');
    this.updateAnswerText();
    this.problemStartedAt = this.time.now;
  }

  /** 問題を解く速さとゲージボール効果を合わせて、正解時に増える捕獲ゲージ量を決めます。 */
  private getCorrectGaugeGain(speedMultiplier: number): number {
    this.activategaugeBallIfAvailable();
    const itemMultiplier = this.gaugeBallActive ? 1.25 : 1;
    return getCaptureGaugeGain(this.stage.captureGaugeGain, speedMultiplier, itemMultiplier);
  }

  /** ゲージボールは最初の正解時に1つだけ消費し、その捕獲中ずっと効果を出します。 */
  private activategaugeBallIfAvailable(): void {
    if (this.gaugeBallChecked) {
      return;
    }

    this.gaugeBallChecked = true;
    const nextState = consumeShopItem(SHOP_ITEM_IDS.gaugeBall);
    if (!nextState) {
      this.captureItemText.setText('アイテムなし');
      return;
    }

    this.gaugeBallActive = true;
    this.gaugeBallAvailable = true;
    this.captureItemText.setText('ボールちゅう');
    this.captureItemText.setColor(COLORS.grassDark);
    this.progressBall.setTexture(getCaptureBallTexture(
      this,
      CAPTURE_LAYOUT.progressBar.ballRadius,
      this.getCurrentBallVariant(),
    ));
  }

  /** ゲージボールが有効なら、ゲージ上のボール見た目を専用デザインにします。 */
  private getCurrentBallVariant(): 'normal' | 'gauge' {
    return this.gaugeBallAvailable || this.gaugeBallActive ? 'gauge' : 'normal';
  }

  /** 問題の種類を見て、専用の式レイアウト描画関数へ振り分けます。 */
  private renderProblem(): void {
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

  /** 縦に並ぶ式カードから、指定した答えになるものを1つ選ぶ問題文を表示します。 */
  private renderChoiceColumnProblem(): void {
    const equationY = CAPTURE_LAYOUT.problemFormula.y - 4;
    const prompt = this.add
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
    const prompt = this.add
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

      const text = this.add.text(0, equationY, part, textStyle).setOrigin(0, 0.5);
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
    return GAME_WIDTH - FORMULA_HORIZONTAL_MARGIN * 2;
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
    return Math.max(FORMULA_HORIZONTAL_MARGIN, (GAME_WIDTH - totalWidth) / 2);
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
    const lineGraphics = this.add.graphics();
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
        this.createRootInlineText(`小数点下${this.getAnswerDecimalPlaces()}けたまで `, equationY, textStyle),
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

    const lineGraphics = this.add.graphics();
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

    const lineGraphics = this.add.graphics();
    this.equationContainer.add(lineGraphics);
    const sourceNumerator = this.add.text(0, numeratorY, String(this.problem.left), fractionStyle).setOrigin(0.5);
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
    const prompt = this.add
      .text(GAME_WIDTH / 2, equationY - 58, '大きいほうのばんごう', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    const optionText = this.add
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
    const textObject = this.add.text(0, y, text, style).setOrigin(0, 0.5);
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
      : this.add.text(0, y, value, style).setOrigin(0.5);
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

      const text = this.add.text(0, equationY, part, textStyle).setOrigin(0, 0.5);
      this.equationContainer.add(text);
      return { kind: 'text' as const, width: text.width, text };
    });
    const totalWidth = visibleParts.reduce((sum, part) => sum + part.width, 0);
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
        cursorX += fittedSlotWidth;
        return;
      }

      part.text.setScale(scale);
      part.text.setX(cursorX);
      cursorX += part.width * scale;
    });

    this.updateAnswerText();
  }

  /** Draws a rectangle with side labels so area problems are read visually, not just as text. */
  private renderShapeAreaProblem(): void {
    if (!isShapeAreaProblem(this.problem)) {
      return;
    }

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const answerDigits = this.getSingleAnswerMaxDigits();
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
    this.drawShapeAreaDiagram(equationY + 2, heightLabel, widthLabel, 62, 44);

    if (this.problem.answerSlot === 'result') {
      const promptText = this.add
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

    const promptText = this.add
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
    const graphics = this.add.graphics();
    const accent = Phaser.Display.Color.HexStringToColor(this.stage.accentColor).color;
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
      const heightText = this.add.text(labelX, labelY, 'たて', labelStyle).setOrigin(0.5);
      this.equationContainer.add(heightText);
      this.drawAnswerBox(labelX - slotWidth / 2, slotY, slotWidth, slotHeight);
      this.answerText.setPosition(labelX, slotY);
    } else {
      const heightText = this.add
        .text(rectX - 28, rectY + rectHeight / 2, `たて\n${heightLabel}`, labelStyle)
        .setOrigin(0.5);
      this.equationContainer.add(heightText);
    }

    if (this.problem.answerSlot === 'right') {
      const labelY = rectY + rectHeight + 24;
      const labelText = this.add.text(GAME_WIDTH / 2 - 48, labelY, 'よこ', labelStyle).setOrigin(0.5);
      const slotX = GAME_WIDTH / 2 - 8;
      this.equationContainer.add(labelText);
      this.drawAnswerBox(slotX, labelY, slotWidth, slotHeight);
      this.answerText.setPosition(slotX + slotWidth / 2, labelY);
    } else {
      const widthText = this.add
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

    const equationY = CAPTURE_LAYOUT.problemFormula.y;
    const answerDigits = this.getSingleAnswerMaxDigits();
    const slotWidth = answerDigits >= 3 ? 122 : 104;
    const slotHeight = 54;
    const answerY = equationY + 90;
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

    const title = this.add
      .text(GAME_WIDTH / 2, equationY - 38, 'ひっ算', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
    const topNumber = this.add.text(rightEdgeX, equationY - 10, leftText, textStyle).setOrigin(1, 0.5);
    const operator = this.add
      .text(operatorX, equationY + 18, this.problem.operator, {
        ...textStyle,
        fontSize: '23px',
      })
      .setOrigin(0.5);
    const bottomNumber = this.add.text(rightEdgeX, equationY + 18, rightText, textStyle).setOrigin(1, 0.5);
    const resultNumber = this.add.text(rightEdgeX, equationY + 52, resultText, textStyle).setOrigin(1, 0.5);
    const graphics = this.add.graphics();
    graphics.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.ink).color, 1);
    graphics.lineBetween(operatorX - 10, equationY + 36, rightEdgeX + 4, equationY + 36);

    this.equationContainer.add([title, topNumber, operator, bottomNumber, resultNumber, graphics]);
    this.drawAnswerBox(GAME_WIDTH / 2 - slotWidth / 2, answerY, slotWidth, slotHeight);
    this.answerText.setPosition(GAME_WIDTH / 2, answerY);
    this.updateAnswerText();
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
    const promptText = this.add
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

      const text = this.add.text(0, equationY, part, textStyle).setOrigin(0, 0.5);
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
    const totalWidth = parts.reduce((sum, part) => sum + part.width, 0);
    let cursorX = Phaser.Math.Clamp(272 - totalWidth / 2, clockCenterX + clockRadius + 16, GAME_WIDTH - totalWidth - 22);
    parts.forEach((part) => {
      if (part.kind === 'slot') {
        this.drawAnswerBox(cursorX, centerY, answerWidth, answerHeight);
        this.answerText.setPosition(cursorX + answerWidth / 2, centerY);
        cursorX += answerWidth;
        return;
      }

      part.text.setX(cursorX);
      cursorX += part.width;
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

      const text = this.add.text(0, centerY, part, labelStyle).setOrigin(0, 0.5);
      this.equationContainer.add(text);
      return { kind: 'text' as const, width: text.width, text };
    });
  }

  /** アナログ時計を描きます。1分きざみ問題では、答えの分だけ赤い目印にします。 */
  private drawAnalogClock(
    centerX: number,
    centerY: number,
    radius: number,
    hour: number,
    minute: number,
    showMinuteMarks: boolean,
  ): void {
    const graphics = this.add.graphics();
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
        const isTargetMinute = mark === minute;
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
      const isTargetMinute = showMinuteMarks && mark === minute;
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
      const numberText = this.add.text(
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

    const lineGraphics = this.add.graphics();
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
    const textPart = this.add.text(0, y, text, style).setOrigin(0, 0.5);
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
      : this.add.text(0, numeratorY, String(numerator), style).setOrigin(0.5);
    const denominatorText = slot === 'denominator'
      ? null
      : this.add.text(0, denominatorY, String(denominator), style).setOrigin(0.5);
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

    this.remainderAnswerText = this.add
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
    if (!this.usesTwoPartAnswer()) {
      return;
    }

    const bounds = this.activeDivisionAnswerPart === 'quotient'
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
  private updateAnswerText(): void {
    if (usesChoiceAnswer(this.problem)) {
      if (usesMultiSelectChoiceAnswer(this.problem) || this.problem.answerMode === 'choiceColumn') {
        this.answerText.setText('');
        return;
      }

      this.answerText.setText(this.getSelectedChoiceOptions()[0]?.label ?? '');
      return;
    }

    if (this.usesTwoPartAnswer()) {
      this.answerText.setText(this.answerInput);
      this.remainderAnswerText?.setText(this.remainderAnswerInput);
      this.answerText.setColor(this.activeDivisionAnswerPart === 'quotient' ? COLORS.blue : COLORS.ink);
      this.remainderAnswerText?.setColor(this.activeDivisionAnswerPart === 'remainder' ? COLORS.blue : COLORS.ink);
      this.drawActiveAnswerHighlight();
      return;
    }

    if (
      isClockTimeProblem(this.problem)
      && this.problem.answerSlot === 'result'
      && this.problem.right !== 0
      && this.answerInput.length >= 3
    ) {
      this.answerText.setText(this.formatClockAnswerInput(this.answerInput));
      return;
    }

    this.answerText.setText(this.answerInput);
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

  /** 捕獲ゲージと先端のボールを同じTweenで動かし、正解時の進みを滑らかに見せます。 */
  private updateProgressBar(animated = false): void {
    const ratio = Phaser.Math.Clamp(this.progress / this.monster.goalGauge, 0, 1);
    const nextWidth = Math.max(1, CAPTURE_LAYOUT.progressBar.width * ratio);
    const nextBallX = CAPTURE_LAYOUT.progressBar.x + nextWidth;

    this.progressTween?.stop();

    if (!animated) {
      this.progressFill.width = nextWidth;
      this.progressBall.setX(nextBallX);
      return;
    }

    const tweenValue = { width: this.progressFill.width };
    this.progressTween = this.tweens.add({
        targets: tweenValue,
        duration: 340,
        ease: 'Cubic.easeOut',
        width: nextWidth,
        onUpdate: () => {
          this.progressFill.width = tweenValue.width;
          this.progressBall.setX(CAPTURE_LAYOUT.progressBar.x + tweenValue.width);
        },
      onComplete: () => {
        this.progressFill.width = nextWidth;
        this.progressBall.setX(nextBallX);
        this.progressTween = undefined;
      },
    });
  }

  /** 捕獲ボールを投げるための重ね画面を出し、スワイプ操作を受け付けます。 */
  private showThrowOverlay(): void {
    this.isBusy = true;
    const overlay = this.add.container(0, 0).setDepth(20);
    const dim = this.add.rectangle(
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT,
      Phaser.Display.Color.HexStringToColor('#1f2633').color,
      0.68,
    );
    dim.setOrigin(0);

    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    const throwPanel = CAPTURE_LAYOUT.throwPanel;
    panel.fillRoundedRect(throwPanel.x, throwPanel.y, throwPanel.width, throwPanel.height, throwPanel.radius);
    panel.strokeRoundedRect(throwPanel.x, throwPanel.y, throwPanel.width, throwPanel.height, throwPanel.radius);

    const ball = createCaptureBall(
      this,
      CAPTURE_LAYOUT.throwBall.x,
      CAPTURE_LAYOUT.throwBall.y,
      CAPTURE_LAYOUT.throwBall.size,
      this.getCurrentBallVariant(),
    );
    const label = this.add
      .text(CAPTURE_LAYOUT.throwLabel.x, CAPTURE_LAYOUT.throwLabel.y, 'ボールを\n上にスワイプ！', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);
    const arrow = this.add
      .text(CAPTURE_LAYOUT.throwArrow.x, CAPTURE_LAYOUT.throwArrow.y, '↑', {
        fontFamily: FONT_FAMILY,
        fontSize: '64px',
        fontStyle: '900',
        color: COLORS.grassDark,
      })
      .setOrigin(0.5);
    const inputZone = this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0.5)
      .setInteractive();

    overlay.add([dim, panel, arrow, ball, label, inputZone]);
    this.bindThrowSwipe(overlay, ball, inputZone);
  }

  /** ボールのドラッグ開始・移動・終了を監視し、十分に上へ動いたら投げ処理へ進めます。 */
  private bindThrowSwipe(
    overlay: Phaser.GameObjects.Container,
    ball: Phaser.GameObjects.Image,
    inputZone: Phaser.GameObjects.Zone,
  ): void {
    let isDragging = false;
    let isFinished = false;
    let startY = 0;
    const baseY = ball.y;
    /** スワイプ開始位置を覚え、ボールの待機アニメーションを止めます。 */
    const startDrag = (pointer: Phaser.Input.Pointer): void => {
      if (isFinished) {
        return;
      }

      isDragging = true;
      startY = pointer.y;
      this.tweens.killTweensOf(ball);
    };
    /** 指の移動量に合わせて、ボールを上方向だけへ動かします。 */
    const handleMove = (pointer: Phaser.Input.Pointer): void => {
      if (!isDragging || isFinished) {
        return;
      }

      const deltaY = Math.min(0, pointer.y - startY);
      ball.y = Phaser.Math.Clamp(baseY + deltaY, CAPTURE_LAYOUT.throwDragTopY, baseY);
    };
    /** 指を離したとき、投げ成功距離なら捕獲演出へ、足りなければ元の位置へ戻します。 */
    const handleUp = (pointer: Phaser.Input.Pointer): void => {
      if (!isDragging || isFinished) {
        return;
      }

      const deltaY = Math.min(0, pointer.y - startY);
      ball.y = Phaser.Math.Clamp(baseY + deltaY, CAPTURE_LAYOUT.throwDragTopY, baseY);
      isDragging = false;
      if (ball.y <= baseY - CAPTURE_LAYOUT.throwSuccessDistance) {
        isFinished = true;
        cleanupSwipeListeners();
        this.finishThrow(overlay);
        return;
      }

      this.tweens.add({ targets: ball, y: baseY, duration: 160, ease: 'Back.easeOut' });
    };

    /** 画面終了時や投げ成功時に、登録した入力イベントをまとめて外します。 */
    const cleanupSwipeListeners = (): void => {
      this.input.off('pointermove', handleMove);
      this.input.off('pointerup', handleUp);
      this.input.off('pointerupoutside', handleUp);
      inputZone.off('pointerdown', startDrag);
      this.events.off('shutdown', cleanupSwipeListeners);
    };

    inputZone.on('pointerdown', startDrag);
    this.input.on('pointermove', handleMove);
    this.input.on('pointerup', handleUp);
    this.input.on('pointerupoutside', handleUp);
    this.events.once('shutdown', cleanupSwipeListeners);
  }

  /** 投げ画面を閉じ、落ちてくるボールの演出が終わったら捕獲結果を出します。 */
  private finishThrow(overlay: Phaser.GameObjects.Container): void {
    overlay.destroy(true);
    const fallingBall = createCaptureBall(
      this,
      CAPTURE_LAYOUT.fallingBallStart.x,
      CAPTURE_LAYOUT.fallingBallStart.y,
      CAPTURE_LAYOUT.fallingBallStart.size,
      this.getCurrentBallVariant(),
    ).setDepth(18);
    this.tweens.add({
      targets: fallingBall,
      y: this.monsterCenter.y,
      duration: 720,
      ease: 'Quad.easeIn',
      onComplete: () => {
        fallingBall.destroy();
        this.showGetPopup();
      },
    });
  }

  /** 捕獲結果を保存し、獲得メッセージと次へ進むボタンを表示します。 */
  private showGetPopup(): void {
    const averageAnswerMs = this.getAverageAnswerMs();
    const fragmentCountBefore = getMonsterFragmentCount(loadSaveState(), this.monster.id);
    let saveState = addCapture(this.monster.id, this.stageId);
    const fragmentGain = Math.max(0, getMonsterFragmentCount(saveState, this.monster.id) - fragmentCountBefore);
    if (averageAnswerMs !== null) {
      saveState = recordStageAverageAnswerTime(this.stageId, averageAnswerMs) ?? saveState;
    }

    const captureCount = saveState.captures[this.monster.id] ?? 1;
    const wasNew = captureCount === 1;
    playCaptureFeedback();

    const overlay = this.add.container(0, 0).setDepth(30);
    const dim = this.add.rectangle(
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT,
      Phaser.Display.Color.HexStringToColor('#fff1a8').color,
      0.94,
    );
    dim.setOrigin(0);

    const inputBlocker = this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0.5)
      .setInteractive();

    const burst = this.add.graphics();
    burst.fillStyle(Phaser.Display.Color.HexStringToColor('#ffffff').color, 1);
    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18;
      const inner = 128;
      const outer = index % 2 === 0 ? 188 : 154;
      burst.fillTriangle(
        CAPTURE_LAYOUT.getPopupBurst.x + Math.cos(angle - 0.08) * inner,
        CAPTURE_LAYOUT.getPopupBurst.y + Math.sin(angle - 0.08) * inner,
        CAPTURE_LAYOUT.getPopupBurst.x + Math.cos(angle) * outer,
        CAPTURE_LAYOUT.getPopupBurst.y + Math.sin(angle) * outer,
        CAPTURE_LAYOUT.getPopupBurst.x + Math.cos(angle + 0.08) * inner,
        CAPTURE_LAYOUT.getPopupBurst.y + Math.sin(angle + 0.08) * inner,
      );
    }

    const monsterVisual = createMonsterVisual(
      this,
      this.monster,
      CAPTURE_LAYOUT.getPopupMonster.x,
      CAPTURE_LAYOUT.getPopupMonster.y,
      CAPTURE_LAYOUT.getPopupMonster.size,
    );
    const message = this.add
      .text(CAPTURE_LAYOUT.getPopupMessage.x, CAPTURE_LAYOUT.getPopupMessage.y, `${this.monster.name}\nゲットだよ！`, {
        fontFamily: FONT_FAMILY,
        fontSize: `${this.getNameLineFontSize(this.monster.name, 38, 34, 30)}px`,
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 10,
        wordWrap: { width: CAPTURE_LAYOUT.getPopupMessage.wrapWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const fragmentText = this.add
      .text(CAPTURE_LAYOUT.getPopupMessage.x, CAPTURE_LAYOUT.getPopupMessage.y + 82, `かけら +${fragmentGain}こ`, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);

    const nextButton = createButton(this, {
      x: CAPTURE_LAYOUT.getPopupButton.x,
      y: CAPTURE_LAYOUT.getPopupButton.y,
      width: CAPTURE_LAYOUT.getPopupButton.width,
      height: CAPTURE_LAYOUT.getPopupButton.height,
      label: 'つぎへ',
      fontSize: 25,
      fillColor: COLORS.panel,
      onClick: () => this.scene.start(SceneKeys.Result, {
        stageId: this.stageId,
        monsterId: this.monster.id,
        wasNew,
        captureCount,
        averageAnswerMs: averageAnswerMs ?? undefined,
      }),
    });

    overlay.add([dim, inputBlocker, burst, monsterVisual, message, fragmentText, nextButton]);
    this.tweens.add({ targets: message, scale: 1.06, yoyo: true, repeat: 2, duration: 120 });
    showRankUpOverlayIfNeeded(this, saveState);
  }

  /** 捕獲までに正解した問題の、1問あたり平均時間をミリ秒で返します。 */
  private getAverageAnswerMs(): number | null {
    if (this.correctAnswerCount <= 0) {
      return null;
    }

    return Math.floor(this.correctAnswerElapsedMsTotal / this.correctAnswerCount);
  }
}
