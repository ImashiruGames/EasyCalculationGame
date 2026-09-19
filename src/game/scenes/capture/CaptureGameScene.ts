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
import { preloadMonsterEvolutionLineImageAssetsByIds } from '../../assets/monsterImageAssets';
import { preloadStageBackgroundAsset } from '../../assets/stageBackgroundAssets';
import { playButtonTapSound, playCaptureFeedback, playCorrectSound, playWrongAnswerSound } from '../../audio';
import { startStageBgm } from '../../bgm';
import { getCaptureGaugeGain } from '../../captureGauge';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { APP_LAYOUT } from '../../layoutConfig';
import { getCaptureAnswerDecimalPlaces, getCaptureAnswerMaxDigits, usesPlaceValueAnswer } from '../../problem/answerInput';
import { ChoiceAnswerGenerator, type ChoiceAnswerOption } from '../../problem/choiceAnswers';
import {
  createProblemAvoiding,
  formatProblemAnswer,
  getProblemAnswerPairJudgement,
  isGridExpressionProblem,
  isProblemAnswerCorrect,
  usesChoiceAnswer,
  usesMultiSelectChoiceAnswer,
  usesOptionalSquareRootCoefficientInput,
  usesTwoPartAnswer,
} from '../../problem/mathProblems';
import { getAnswerSpeedBonus } from '../../problem/speedBonus';
import { SceneKeys } from '../../sceneKeys';
import {
  CaptureSceneData,
  MathProblem,
  MonsterDefinition,
  StageDefinition,
  StageId,
} from '../../types';
import { showRankUpOverlayIfNeeded } from '../../ui/achievements/rankUpOverlay';
import { createCaptureBall, getCaptureBallTexture } from '../../ui/capture/captureBall';
import { createButton, createSmallButton } from '../../ui/common/button';
import { showGameMenu } from '../../ui/common/gameMenu';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { CaptureProblemView, type CaptureAnswerDisplayState } from '../../ui/problem/CaptureProblemView';
import { getChoiceCardLayout } from '../../ui/problem/choiceCardLayout';
import { drawNumberKeypad, NumberKeypadLabel, resolveNumberKeyInput } from '../../ui/problem/numberKeypad';
import { drawCaptureReadabilityPanel, drawStageBackdrop } from '../../ui/stage/stageBackdrop';

const CAPTURE_LAYOUT = APP_LAYOUT.captureGame;
type RareEncounterIntro = 'none' | 'rare' | 'superRare';
type DivisionAnswerPart = 'quotient' | 'remainder';
interface ChoiceAnswerCard {
  option: ChoiceAnswerOption;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  width: number;
  height: number;
}

export class CaptureGameScene extends Phaser.Scene {
  private problemView: CaptureProblemView;
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
  private keypadContainer?: Phaser.GameObjects.Container;
  private choiceOptions: ChoiceAnswerOption[] = [];
  private selectedChoiceIds = new Set<string>();
  private choiceCards: ChoiceAnswerCard[] = [];
  private gridProblemFocusLayer?: Phaser.GameObjects.Container;

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
    this.keypadContainer = undefined;
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

  /** Creates the question view and scene-owned feedback and choice controls. */
  private drawProblemArea(): void {
    this.problemView = new CaptureProblemView(this, this.stage.accentColor);

    this.feedbackText = this.add
      .text(CAPTURE_LAYOUT.feedbackText.x, CAPTURE_LAYOUT.feedbackText.y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.grassDark,
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: CAPTURE_LAYOUT.regions.feedback.width, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.choiceControlsContainer = this.add.container(0, 0);
  }

  /** ステージ内容に合わせて小数点つき/なしのテンキーを作ります。 */
  private drawKeypad(): void {
    this.keypadContainer?.destroy(true);
    this.keypadContainer = drawNumberKeypad(this, {
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

  /** 選択式問題用のカードと、選んでから答えるためのボタンを描画します。 */
  private renderChoiceControls(): void {
    this.clearChoiceControls();
    if (!usesChoiceAnswer(this.problem)) {
      return;
    }

    this.choiceOptions = new ChoiceAnswerGenerator(this.problem, getCaptureAnswerDecimalPlaces(this.problem), Phaser.Utils.Array.Shuffle).createOptions();
    const layout = getChoiceCardLayout(this, this.choiceOptions.map((option) => option.label), this.problem.answerMode);
    this.choiceOptions.forEach((option, index) => {
      const position = layout.positions[index];
      if (!position) {
        return;
      }

      const card = this.createChoiceCard(option, position.x, position.y, layout.width, layout.height, layout.fontSize);
      this.choiceCards.push(card);
    });

    if (usesMultiSelectChoiceAnswer(this.problem)) {
      const clearButton = createButton(this, {
        x: 126,
        y: CAPTURE_LAYOUT.regions.choiceActions.y + CAPTURE_LAYOUT.regions.choiceActions.height / 2,
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
      y: CAPTURE_LAYOUT.regions.choiceActions.y + CAPTURE_LAYOUT.regions.choiceActions.height / 2,
      width: usesMultiSelectChoiceAnswer(this.problem) ? 132 : 172,
      height: 56,
      label: 'こたえる',
      fontSize: 20,
      fillColor: COLORS.yellow,
      onClick: () => this.submitChoiceAnswer(),
    });
    this.choiceControlsContainer.add(submitButton);
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
    fontSize: number,
  ): ChoiceAnswerCard {
    const container = this.add.container(x, y);
    const background = this.add.graphics();
    const label = this.add
      .text(0, 0, option.label, {
        fontFamily: FONT_FAMILY,
        fontSize: `${fontSize}px`,
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 2,
        wordWrap: { width: width - 24, useAdvancedWrap: true },
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
    this.setFeedbackMessage(`こたえは ${this.getChoiceCorrectAnswerLabel()}`);
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

    const answerDecimalPlaces = getCaptureAnswerDecimalPlaces(this.problem);
    const maxDigits = getCaptureAnswerMaxDigits(this.problem, answerDecimalPlaces);
    const result = resolveNumberKeyInput(label, this.answerInput, maxDigits, {
      allowDecimalPoint: answerDecimalPlaces > 0,
      decimalPlaces: answerDecimalPlaces,
      onesFirst: usesPlaceValueAnswer(this.problem),
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
    const maxDigits = this.problem.answerMode === 'measurementPair' && this.activeDivisionAnswerPart === 'remainder' ? 1 : 2;
    const result = resolveNumberKeyInput(label, currentInput, maxDigits);
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
    this.setFeedbackMessage(`こたえは ${formatProblemAnswer(this.problem)}`);
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
    this.setFeedbackMessage(`${judgement === 'partial' ? '△ ' : ''}こたえは ${formatProblemAnswer(this.problem)}`);
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
    this.showGridExpressionCorrectFocus();

    if (this.progress >= this.monster.goalGauge) {
      if (isGridExpressionProblem(this.problem)) {
        this.time.delayedCall(560, () => this.fadeOutGridExpressionCorrectFocus(() => this.showThrowOverlay()));
        return;
      }

      this.time.delayedCall(450, () => this.showThrowOverlay());
      return;
    }

    if (isGridExpressionProblem(this.problem)) {
      this.time.delayedCall(560, () => this.fadeOutGridExpressionCorrectFocus(() => this.showNextProblem()));
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

    if (isGridExpressionProblem(this.problem)) {
      this.showGridExpressionCorrectMark();
      return;
    }

    const target = this.problemView.getCorrectMarkTarget();
    const markX = target.x;
    const markY = target.y;
    const mark = this.add.container(markX, markY);
    const graphics = this.add.graphics();
    const markColor = Phaser.Display.Color.HexStringToColor(COLORS.grassDark).color;
    const radius = Math.max(40, Math.min(96, target.width / 2 + 30));
    const region = CAPTURE_LAYOUT.regions.question;
    const verticalRadius = Math.max(12, Math.min(radius, markY - region.y - 6, region.y + region.height - markY - 6));

    graphics.lineStyle(7, markColor, 0.92);
    graphics.strokeEllipse(0, 0, radius * 2, verticalRadius * 2);
    mark.add(graphics);
    mark.setScale(0.72);
    this.problemView.equationContainer.add(mark);
    this.tweens.add({
      targets: mark,
      scale: 1,
      alpha: { from: 0.45, to: 1 },
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  /** Draws the correct mark around the answer text inside a grid problem card. */
  private showGridExpressionCorrectMark(): void {
    if (!this.problemView.gridProblemAnswerText) {
      return;
    }

    const mark = this.add.container(this.problemView.gridProblemAnswerText.x, this.problemView.gridProblemAnswerText.y);
    const graphics = this.add.graphics();
    const markColor = Phaser.Display.Color.HexStringToColor(COLORS.grassDark).color;
    const radius = Math.max(44, Math.min(92, Math.max(this.problemView.gridProblemAnswerText.width, this.problemView.gridProblemAnswerText.height) / 2 + 24));
    const region = CAPTURE_LAYOUT.regions.gridQuestion;
    const verticalRadius = Math.min(radius, region.y + region.height - mark.y - 6);

    graphics.lineStyle(7, markColor, 0.92);
    graphics.strokeEllipse(0, 0, radius * 2, verticalRadius * 2);
    mark.add(graphics);
    mark.setScale(0.72);
    this.problemView.gridProblemLayer?.add(mark);
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
    this.renderAnswerControls();
    this.feedbackText.setText('');
    this.updateAnswerText();
    this.problemStartedAt = this.time.now;
  }

  /** Switches answer controls per question while reusing an unchanged number keypad. */
  private renderAnswerControls(): void {
    if (usesChoiceAnswer(this.problem)) {
      this.keypadContainer?.destroy(true);
      this.keypadContainer = undefined;
    } else if (!this.keypadContainer) {
      this.drawKeypad();
    }
    this.renderChoiceControls();
  }

  /** Fits complete feedback into its reserved region without clipping or ellipsis. */
  private setFeedbackMessage(message: string): void {
    const region = CAPTURE_LAYOUT.regions.feedback;
    this.feedbackText.setText(message).setFontSize(22).setWordWrapWidth(region.width, true);
    for (let size = 21; size >= 18 && this.feedbackText.height > region.height; size -= 1) {
      this.feedbackText.setFontSize(size);
    }
    if (import.meta.env.DEV && this.feedbackText.height > region.height) {
      console.warn('Capture feedback exceeds its reserved region:', message);
    }
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

  /** Draws the next question after removing the capture focus effect. */
  private renderProblem(): void {
    this.clearGridProblemFocusLayer();
    this.problemView.render(this.problem, this.getAnswerDisplayState());
  }

  /** Removes the temporary monster focus layer used after a grid problem answer. */
  private clearGridProblemFocusLayer(): void {
    if (this.gridProblemFocusLayer) {
      this.tweens.killTweensOf(this.gridProblemFocusLayer);
    }
    this.gridProblemFocusLayer?.destroy(true);
    this.gridProblemFocusLayer = undefined;
  }

  /** Shows the monster and capture gauge above a faded grid problem after a correct answer. */
  private showGridExpressionCorrectFocus(): void {
    if (!isGridExpressionProblem(this.problem)) {
      return;
    }

    this.clearGridProblemFocusLayer();
    if (this.problemView.gridProblemLayer) {
      this.tweens.killTweensOf(this.problemView.gridProblemLayer);
      this.tweens.add({
        targets: this.problemView.gridProblemLayer,
        alpha: 0.32,
        duration: 180,
        ease: 'Sine.easeOut',
      });
    }

    const layer = this.add.container(0, 0).setDepth(12);
    layer.setAlpha(0);
    this.gridProblemFocusLayer = layer;

    const panel = this.add.graphics();
    const monsterPanel = CAPTURE_LAYOUT.monsterPanel;
    const fillColor = this.hasStageBackground ? COLORS.panel : this.monster.palette.background;
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(fillColor).color, 0.98);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(this.stage.accentColor).color, 0.95);
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

    const monsterVisual = createMonsterVisual(
      this,
      this.monster,
      this.monsterCenter.x,
      this.monsterCenter.y,
      CAPTURE_LAYOUT.monsterSize,
    );

    const nameText = this.add
      .text(CAPTURE_LAYOUT.monsterName.x, CAPTURE_LAYOUT.monsterName.y, this.monster.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);

    layer.add([panel, monsterVisual, nameText]);
    this.drawFocusedProgressGauge(layer);
    this.tweens.add({
      targets: layer,
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }

  /** Fades the correct-answer focus layer away before moving to the next step. */
  private fadeOutGridExpressionCorrectFocus(onComplete: () => void): void {
    const problemLayer = this.problemView.gridProblemLayer;
    const focusLayer = this.gridProblemFocusLayer;
    if (!problemLayer && !focusLayer) {
      onComplete();
      return;
    }

    if (problemLayer) {
      this.tweens.killTweensOf(problemLayer);
      this.tweens.add({
        targets: problemLayer,
        alpha: 0,
        duration: 170,
        ease: 'Sine.easeIn',
      });
    }

    if (!focusLayer) {
      this.time.delayedCall(170, onComplete);
      return;
    }

    this.tweens.killTweensOf(focusLayer);
    this.tweens.add({
      targets: focusLayer,
      alpha: 0,
      duration: 170,
      ease: 'Sine.easeIn',
      onComplete,
    });
  }

  /** Draws the focused capture gauge using the current progress value. */
  private drawFocusedProgressGauge(layer: Phaser.GameObjects.Container): void {
    const ratio = Phaser.Math.Clamp(this.progress / this.monster.goalGauge, 0, 1);
    const width = Math.max(1, CAPTURE_LAYOUT.progressBar.width * ratio);
    const progressX = CAPTURE_LAYOUT.progressBar.x;
    const progressY = CAPTURE_LAYOUT.progressBar.y;

    const gauge = this.add.graphics();
    gauge.fillStyle(Phaser.Display.Color.HexStringToColor('#d8e0e8').color, 1);
    gauge.fillRoundedRect(
      progressX,
      progressY - CAPTURE_LAYOUT.progressBar.height / 2,
      CAPTURE_LAYOUT.progressBar.width,
      CAPTURE_LAYOUT.progressBar.height,
      CAPTURE_LAYOUT.progressBar.height / 2,
    );
    gauge.fillStyle(Phaser.Display.Color.HexStringToColor(this.stage.accentColor).color, 1);
    gauge.fillRoundedRect(
      progressX,
      progressY - CAPTURE_LAYOUT.progressBar.height / 2,
      width,
      CAPTURE_LAYOUT.progressBar.height,
      CAPTURE_LAYOUT.progressBar.height / 2,
    );

    const ball = createCaptureBall(
      this,
      progressX + width,
      progressY,
      CAPTURE_LAYOUT.progressBar.ballRadius,
      this.getCurrentBallVariant(),
    );
    layer.add([gauge, ball]);
  }

  /** Sends the current input to the view without moving gameplay state into it. */
  private updateAnswerText(): void {
    this.problemView.updateAnswerText(this.getAnswerDisplayState());
  }

  /** Collects only the input values needed to display the answer fields. */
  private getAnswerDisplayState(): CaptureAnswerDisplayState {
    return {
      first: this.answerInput,
      second: this.remainderAnswerInput,
      activePart: this.activeDivisionAnswerPart,
      selectedChoiceLabel: this.getSelectedChoiceOptions()[0]?.label,
    };
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
