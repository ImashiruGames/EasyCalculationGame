import * as Phaser from 'phaser';
import {
  getEvolutionLabel,
  getMonsterById,
  getStageMonsterId,
  monsters,
  pickEncounterMonsterId,
} from '../../../data/monsters';
import { getEmbeddedStoryDraftForMonsterDex } from '../../../data/stories';
import { SHOP_ITEM_IDS } from '../../../data/shopItems';
import { getStageById } from '../../../data/stages';
import {
  canExchangeFragmentsForCandy,
  canUnlockDexStory,
  canUnlockDexStoryWithCandy,
  exchangeFragmentsForCandy,
  getCandyCount,
  getDexStoryUnlockCandyShortfall,
  getItemCount,
  getMonsterCaptureCount,
  getMonsterFragmentCount,
  getStagePlayLimitStatus,
  isDexStoryUnlocked,
  loadSaveState,
  recordEncounterMonster,
  recordStagePlayEntry,
  recordStagePlayEntryUsingItem,
  unlockDexStory,
} from '../../../state/save';
import { EvolutionProgress, getEvolutionProgress } from '../../../state/evolution';
import { playButtonTapSound, playExchangeSound } from '../../audio';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { MonsterDefinition, ResultSceneData, StageDefinition, StageId } from '../../types';
import { createButton } from '../../ui/common/button';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';
import { drawStagePlayLimitGauge, scheduleStagePlayLimitRefresh } from '../../ui/stage/stagePlayLimitGauge';
import { showRankUpOverlayIfNeeded } from '../../ui/achievements/rankUpOverlay';
import { startStageBgm } from '../../bgm';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { preloadRankMedalAssets } from '../../assets/medalAssets';

interface ResultEvolutionOption {
  sourceMonster: MonsterDefinition;
  evolutionTarget: MonsterDefinition | null;
  isEvolutionTargetRegistered: boolean;
  fragmentCount: number;
  candyCount: number;
  evolution: EvolutionProgress;
}

/** 描画中に追加された表示物を、あとでまとめて消せるレイヤーに入れます。 */
function captureDrawLayer(scene: Phaser.Scene, draw: () => void): Phaser.GameObjects.Container {
  const layer = scene.add.container(0, 0);
  const existingChildren = new Set(scene.children.getChildren());
  draw();
  const addedChildren = scene.children
    .getChildren()
    .filter((child) => child !== layer && !existingChildren.has(child));
  addedChildren.forEach((child) => layer.add(child));
  return layer;
}

export class ResultScene extends Phaser.Scene {
  private monsterId = 'picoleaf';
  private stageId: StageId = 'g1-tashizan-hazimarinosougen';
  private stage!: StageDefinition;
  private wasNew = false;
  private latestCaptureCount: number | null = null;
  private evolvedFromMonsterId: string | null = null;
  private conversionMessage: string | null = null;
  private contentLayer?: Phaser.GameObjects.Container;
  private storyUnlockConfirmLayer?: Phaser.GameObjects.Container;

  /** Phaserに結果画面のSceneキーを登録します。 */
  constructor() {
    super(SceneKeys.Result);
  }

  /** 捕まえたモンスターや進化後の状態など、結果表示に必要な値を受け取ります。 */
  init(data?: ResultSceneData): void {
    this.monsterId = data?.monsterId ?? 'picoleaf';
    this.stageId = data?.stageId ?? 'g1-tashizan-hazimarinosougen';
    this.stage = getStageById(this.stageId);
    this.wasNew = data?.wasNew ?? false;
    this.latestCaptureCount = data?.captureCount ?? null;
    this.evolvedFromMonsterId = data?.evolvedFromMonsterId ?? null;
    this.conversionMessage = data?.conversionMessage ?? null;
  }

  /** 結果画面で見せるモンスター、進化ライン、メダル画像を先読みします。 */
  preload(): void {
    const saveState = loadSaveState();
    const monster = getMonsterById(this.monsterId);
    const evolutionOption = this.getFamilyEvolutionOption(monster, saveState);

    preloadMonsterImageAssetsByIds(this, [
      monster.id,
      evolutionOption.sourceMonster.id,
      evolutionOption.evolutionTarget?.id,
      ...this.getEvolutionLine(evolutionOption.sourceMonster).map((lineMonster) => lineMonster.id),
    ]);
    preloadRankMedalAssets(this);
  }

  /** 捕獲結果、進化の進み具合、次の行動ボタンを順番に描きます。 */
  create(): void {
    startStageBgm(this.stageId);
    const monster = getMonsterById(this.monsterId);
    const saveState = loadSaveState();

    this.cameras.main.setBackgroundColor('#fffaf0');
    this.drawBackground(monster);
    this.redrawResultView();
    showRankUpOverlayIfNeeded(this, saveState);
  }

  /** 結果画面の内容だけを、Sceneを再起動せず描き直します。 */
  private redrawResultView(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = captureDrawLayer(this, () => {
      const monster = getMonsterById(this.monsterId);
      const saveState = loadSaveState();
      const captureCount = this.latestCaptureCount ?? getMonsterCaptureCount(saveState, monster.id);
      const fragmentCount = getMonsterFragmentCount(saveState, monster.id);
      const evolutionOption = this.getFamilyEvolutionOption(monster, saveState);

      this.drawTitle();
      this.drawResultNotice();
      this.drawMonsterPanel(monster, captureCount, fragmentCount);
      this.drawProgressPanel(
        monster,
        captureCount,
        evolutionOption,
      );
      this.drawFooter(evolutionOption);
    });
  }

  /** 捕獲済みの進化元候補から、今いちばん進化を進めるべき対象を選びます。 */
  private getFamilyEvolutionOption(
    monster: MonsterDefinition,
    saveState: ReturnType<typeof loadSaveState>,
  ): ResultEvolutionOption {
    const familyOptions = monsters
      .filter((candidate) => (
        candidate.evolutionFamilyId === monster.evolutionFamilyId
        && candidate.nextEvolutionId !== null
        && getMonsterCaptureCount(saveState, candidate.id) > 0
      ))
      .map((sourceMonster) => this.createEvolutionOption(sourceMonster, saveState));
    return familyOptions
      .sort((left, right) => right.sourceMonster.evolutionStage - left.sourceMonster.evolutionStage)[0]
      ?? this.createEvolutionOption(monster, saveState);
  }

  /** 進化先、かけら、アメ、進化可否を一つの表示用データにまとめます。 */
  private createEvolutionOption(
    sourceMonster: MonsterDefinition,
    saveState: ReturnType<typeof loadSaveState>,
  ): ResultEvolutionOption {
    const evolutionTarget = sourceMonster.nextEvolutionId ? getMonsterById(sourceMonster.nextEvolutionId) : null;
    const isEvolutionTargetRegistered = evolutionTarget !== null
      && getMonsterCaptureCount(saveState, evolutionTarget.id) > 0;
    const fragmentCount = getMonsterFragmentCount(saveState, sourceMonster.id);
    const candyCount = getCandyCount(saveState, sourceMonster.attribute);
    const evolution = getEvolutionProgress(sourceMonster, fragmentCount);

    return {
      sourceMonster,
      evolutionTarget,
      isEvolutionTargetRegistered,
      fragmentCount,
      candyCount,
      evolution,
    };
  }

  /** モンスターの色に合わせた丸い背景を置き、結果画面の土台を作ります。 */
  private drawBackground(monster: MonsterDefinition): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fffaf0').color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(monster.palette.background).color, 1);
    graphics.fillCircle(70, 122, 86);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#eaf7ff').color, 1);
    graphics.fillCircle(330, 720, 130);
  }

  /** 進化結果か通常捕獲かに合わせて、画面タイトルを切り替えます。 */
  private drawTitle(): void {
    const title = this.evolvedFromMonsterId ? 'しんかした！' : 'こんかいのモンスター';
    this.add
      .text(GAME_WIDTH / 2, 72, title, {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  /** ストーリー解放やアメ交換の短い結果通知を、素材欄とは別の場所に描きます。 */
  private drawResultNotice(): void {
    if (!this.conversionMessage) {
      return;
    }

    const width = 246;
    const height = 24;
    const y = 102;
    const graphics = this.add.graphics();
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor('#fff1a8').color, 0.96);
    graphics.lineStyle(2, Phaser.Display.Color.HexStringToColor('#b8941e').color, 0.9);
    graphics.fillRoundedRect((GAME_WIDTH - width) / 2, y - height / 2, width, height, 12);
    graphics.strokeRoundedRect((GAME_WIDTH - width) / 2, y - height / 2, width, height, 12);

    this.add
      .text(GAME_WIDTH / 2, y, this.conversionMessage, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: width - 18, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  /** 捕まえたモンスター、名前、捕獲数、かけら数をカードにまとめます。 */
  private drawMonsterPanel(
    monster: MonsterDefinition,
    captureCount: number,
    fragmentCount: number,
  ): void {
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    panel.fillRoundedRect(58, 116, 274, 236, 22);
    panel.strokeRoundedRect(58, 116, 274, 236, 22);

    panel.fillStyle(Phaser.Display.Color.HexStringToColor(monster.palette.background).color, 1);
    panel.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    panel.fillCircle(GAME_WIDTH / 2, 184, 56);
    panel.strokeCircle(GAME_WIDTH / 2, 184, 56);
    createMonsterVisual(this, monster, GAME_WIDTH / 2, 184, 86);

    this.add
      .text(GAME_WIDTH / 2, 266, monster.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '23px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    const countText = `つかまえた ${captureCount} / かけら ${fragmentCount}`;
    this.add
      .text(GAME_WIDTH / 2, 320, countText, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '800',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    if (this.wasNew) {
      this.drawNewBadge(290, 136);
    }
  }

  /** はじめて捕まえた印として、カード右上にNEWバッジを描きます。 */
  private drawNewBadge(x: number, y: number): void {
    const badge = this.add.graphics();
    badge.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.red).color, 1);
    badge.lineStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    badge.fillRoundedRect(x - 35, y - 16, 70, 32, 16);
    badge.strokeRoundedRect(x - 35, y - 16, 70, 32, 16);

    this.add
      .text(x, y, 'NEW', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.panel,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  /** 進化状況、必要素材、アメ交換の案内をまとめた進み具合パネルを描きます。 */
  private drawProgressPanel(
    monster: MonsterDefinition,
    captureCount: number,
    evolutionOption: ResultEvolutionOption,
  ): void {
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    panel.fillRoundedRect(68, 386, 254, 186, 18);
    panel.strokeRoundedRect(68, 386, 254, 186, 18);

    const evolvedFrom = this.evolvedFromMonsterId ? getMonsterById(this.evolvedFromMonsterId) : null;
    const sourceMonster = evolutionOption.sourceMonster;
    const isFamilyEvolution = sourceMonster.id !== monster.id;
    const remainingFragments = evolutionOption.evolution.remainingFragments;
    const requiredFragments = evolutionOption.evolution.requiredFragments;
    const hasEvolutionLine = this.getEvolutionLine(sourceMonster).length > 1;
    const progressText =
      evolvedFrom
        ? `${evolvedFrom.name}から\nしんかした！`
        : evolutionOption.isEvolutionTargetRegistered && evolutionOption.evolutionTarget
        ? 'しんかはそろってるよ！\nたくさんあつめて\nアメにしよう！'
        : remainingFragments === null
        ? 'しんかしないよ\nたくさんあつめて\nアメにしよう！'
        : evolutionOption.evolution.canEvolve
          ? isFamilyEvolution
            ? `${sourceMonster.name}を\nしんかできるよ！`
            : 'しんかできるよ！'
          : isFamilyEvolution
            ? `${sourceMonster.name}\nあと ${remainingFragments}こ`
            : `しんかまであと\n${remainingFragments}こ`;
    const progressTextStyle = this.getProgressTextStyle(progressText, hasEvolutionLine, isFamilyEvolution);

    this.add
      .text(GAME_WIDTH / 2, progressTextStyle.y, progressText, {
        fontFamily: FONT_FAMILY,
        fontSize: `${progressTextStyle.fontSize}px`,
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: progressTextStyle.lineSpacing,
        wordWrap: { width: progressTextStyle.wrapWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    if (hasEvolutionLine) {
      this.drawResultEvolutionLine(sourceMonster, 506);
    }

    const materialText = requiredFragments === null
      ? `${getEvolutionLabel(monster)} / ${captureCount}ひき`
      : `${isFamilyEvolution ? `${sourceMonster.name} ` : ''}かけら ${evolutionOption.fragmentCount}/${requiredFragments}`;
    const candyText = evolutionOption.candyCount <= 0
      ? null
      : `${sourceMonster.elementName}アメ ${evolutionOption.candyCount}こ`;
    this.drawMaterialStatus(materialText, candyText);
  }

  /** アメより優先したい、かけら中心の素材状態を描きます。 */
  private drawMaterialStatus(materialText: string, candyText: string | null): void {
    const mainY = candyText ? 362 : 368;
    this.add
      .text(GAME_WIDTH / 2, mainY, materialText, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '800',
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: 270, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    if (!candyText) {
      return;
    }

    this.add
      .text(GAME_WIDTH / 2, 380, candyText, {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        fontStyle: '800',
        color: COLORS.muted,
      })
      .setOrigin(0.5)
      .setAlpha(0.68);
  }

  /** かけらをアメに変える案内を出してよい状態かを判定します。 */
  private canSuggestCandyConversion(evolutionOption: ResultEvolutionOption): boolean {
    const saveState = loadSaveState();
    return canExchangeFragmentsForCandy(
      saveState,
      evolutionOption.sourceMonster.id,
      evolutionOption.sourceMonster.attribute,
    );
  }

  /** 進化メッセージの行数と長さに合わせて、文字サイズと位置を調整します。 */
  private getProgressTextStyle(
    text: string,
    hasEvolutionLine: boolean,
    isFamilyEvolution: boolean,
  ): { y: number; fontSize: number; lineSpacing: number; wrapWidth: number } {
    const longestLineLength = text
      .split('\n')
      .reduce((longest, line) => Math.max(longest, line.length), 0);
    const lineCount = text.split('\n').length;
    const fontSize =
      lineCount >= 3 && longestLineLength >= 11
        ? 18
        : longestLineLength >= 13
        ? 19
        : longestLineLength >= 10
          ? 21
          : isFamilyEvolution
            ? 22
            : 24;

    return {
      y: hasEvolutionLine ? 430 : 444,
      fontSize,
      lineSpacing: hasEvolutionLine && lineCount >= 3 ? 3 : hasEvolutionLine ? 5 : 7,
      wrapWidth: 236,
    };
  }

  /** 進化ラインを小さなアイコン列で描き、今回進化した対象を光らせます。 */
  private drawResultEvolutionLine(sourceMonster: MonsterDefinition, y: number): void {
    const line = this.getEvolutionLine(sourceMonster);
    if (line.length <= 1) {
      return;
    }

    const saveState = loadSaveState();
    const spacing = line.length === 2 ? 92 : 72;
    const startX = GAME_WIDTH / 2 - (spacing * (line.length - 1)) / 2;
    line.forEach((lineMonster, index) => {
      const x = startX + index * spacing;
      const isRegistered = getMonsterCaptureCount(saveState, lineMonster.id) > 0;
      const showSilhouette = !isRegistered;
      const isJustEvolvedMonster = this.evolvedFromMonsterId !== null && lineMonster.id === this.monsterId;

      if (index > 0) {
        this.add
          .text(x - spacing / 2, y, '→', {
            fontFamily: FONT_FAMILY,
            fontSize: '19px',
            fontStyle: '900',
            color: COLORS.muted,
          })
          .setOrigin(0.5);
      }

      const circle = this.add
        .circle(
          x,
          y,
          26,
          Phaser.Display.Color.HexStringToColor(showSilhouette ? '#eef2f7' : lineMonster.palette.background).color,
          1,
        )
        .setStrokeStyle(
          2,
          Phaser.Display.Color.HexStringToColor(showSilhouette ? COLORS.muted : lineMonster.palette.accent).color,
          0.85,
        );
      const visual = createMonsterVisual(this, lineMonster, x, y, 46, showSilhouette);
      if (isJustEvolvedMonster && !showSilhouette) {
        this.playEvolutionUnlockPulse(x, y, lineMonster, circle, visual);
      }
      this.drawResultStoryButton(lineMonster, x, y + 39, saveState, isRegistered);
    });
  }

  /** 進化ライン内の各モンスターに、ストーリー解放または読む小ボタンを描きます。 */
  private drawResultStoryButton(
    monster: MonsterDefinition,
    x: number,
    y: number,
    saveState: ReturnType<typeof loadSaveState>,
    isRegistered: boolean,
  ): void {
    if (!isRegistered || !this.hasDexStoryDraft(monster)) {
      return;
    }

    const isUnlocked = isDexStoryUnlocked(saveState, monster.id);
    const requiredFragments = monster.dexStoryRequiredFragments;
    if (!isUnlocked && requiredFragments === null) {
      return;
    }
    if (!isUnlocked && !this.arePreviousDexStoryDraftsUnlocked(saveState, monster)) {
      return;
    }

    const canUnlock = canUnlockDexStory(saveState, monster.id) || canUnlockDexStoryWithCandy(saveState, monster.id);
    if (!isUnlocked) {
      if (requiredFragments === null) {
        return;
      }

      this.createStoryUnlockButton(x, y, requiredFragments, canUnlock, () => this.unlockResultStory(monster));
      return;
    }

    createButton(this, {
      x,
      y,
      width: 62,
      height: 24,
      label: 'よむ',
      fillColor: '#fff1a8',
      strokeColor: '#b8941e',
      fontSize: 11,
      onClick: () => this.openResultStory(monster),
    }).setDepth(8);
  }

  /** 未解放ストーリー用の、金色の封印つき小ボタンを作ります。 */
  private createStoryUnlockButton(
    x: number,
    y: number,
    requiredFragments: number,
    canUnlock: boolean,
    onClick: () => void,
  ): void {
    const width = 66;
    const height = 30;
    const container = this.add.container(x, y).setDepth(8);
    const glow = this.add.graphics();
    const body = this.add.graphics();
    const seal = this.add.graphics();

    glow.fillStyle(Phaser.Display.Color.HexStringToColor('#fff1a8').color, canUnlock ? 0.45 : 0.12);
    glow.fillRoundedRect(-width / 2 - 5, -height / 2 - 4, width + 10, height + 8, 16);

    body.fillStyle(Phaser.Display.Color.HexStringToColor(canUnlock ? '#fff1a8' : '#eef2f7').color, 1);
    body.lineStyle(2, Phaser.Display.Color.HexStringToColor(canUnlock ? '#b8941e' : COLORS.muted).color, canUnlock ? 1 : 0.72);
    body.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    body.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
    body.fillStyle(Phaser.Display.Color.HexStringToColor(canUnlock ? '#ffd766' : '#d8dde6').color, 1);
    body.fillCircle(-width / 2 + 12, 0, 9);

    seal.lineStyle(2, Phaser.Display.Color.HexStringToColor(canUnlock ? '#7d2a22' : COLORS.muted).color, 0.9);
    seal.strokeCircle(-width / 2 + 12, -2, 4);
    seal.lineBetween(-width / 2 + 12, 2, -width / 2 + 12, 8);
    seal.lineBetween(-width / 2 + 12, 6, -width / 2 + 17, 6);

    const label = this.add
      .text(8, 0, `お話\n${requiredFragments}こ`, {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        fontStyle: '900',
        color: canUnlock ? '#7d2a22' : COLORS.muted,
        align: 'center',
        lineSpacing: -2,
      })
      .setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, width + 8, height + 8).setOrigin(0.5);
    container.add([glow, body, seal, label, hitZone]);
    container.setSize(width + 8, height + 8);

    if (!canUnlock) {
      container.setAlpha(0.72);
      return;
    }

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.55, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 780,
      ease: 'Sine.easeInOut',
    });
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => {
      playButtonTapSound();
      this.tweens.add({ targets: container, scale: 0.94, duration: 70 });
    });
    hitZone.on('pointerup', () => {
      this.tweens.add({ targets: container, scale: 1, duration: 80 });
      onClick();
    });
    hitZone.on('pointerout', () => {
      this.tweens.add({ targets: container, scale: 1, duration: 80 });
    });
  }

  /** 指定モンスターに、図鑑ストーリーとして読めるJSONがあるか確認します。 */
  private hasDexStoryDraft(monster: MonsterDefinition): boolean {
    return monster.dexStoryEnabled && getEmbeddedStoryDraftForMonsterDex(monster.id) !== undefined;
  }

  /** 進化前に読める図鑑ストーリーがある時、すべて解放済みか調べます。 */
  private arePreviousDexStoryDraftsUnlocked(
    saveState: ReturnType<typeof loadSaveState>,
    monster: MonsterDefinition,
  ): boolean {
    let previousId = monster.previousEvolutionId;
    while (previousId) {
      const previousMonster = getMonsterById(previousId);
      if (this.hasDexStoryDraft(previousMonster) && !isDexStoryUnlocked(saveState, previousMonster.id)) {
        return false;
      }

      previousId = previousMonster.previousEvolutionId;
    }

    return true;
  }

  /** 結果画面へ戻るために、現在の表示状態をSceneデータへまとめます。 */
  private getReturnResultData(extra: Partial<ResultSceneData> = {}): ResultSceneData {
    return {
      stageId: this.stageId,
      monsterId: this.monsterId,
      wasNew: this.wasNew,
      captureCount: this.latestCaptureCount ?? undefined,
      evolvedFromMonsterId: this.evolvedFromMonsterId ?? undefined,
      conversionMessage: this.conversionMessage ?? undefined,
      ...extra,
    };
  }

  /** 結果画面から解放済みの図鑑ストーリーを開きます。 */
  private openResultStory(monster: MonsterDefinition): void {
    const draft = getEmbeddedStoryDraftForMonsterDex(monster.id);
    if (!draft) {
      return;
    }

    this.scene.start(SceneKeys.StoryPreview, {
      draft,
      returnScene: 'result',
      returnResultData: this.getReturnResultData(),
    });
  }

  /** かけらかアメ補助を使って図鑑ストーリーを解放し、必要なら確認を出します。 */
  private unlockResultStory(monster: MonsterDefinition): void {
    const saveState = loadSaveState();
    if (canUnlockDexStory(saveState, monster.id)) {
      if (unlockDexStory(monster.id)) {
        this.finishStoryUnlock('お話をひらいたよ！');
      }
      return;
    }

    const missingFragments = getDexStoryUnlockCandyShortfall(saveState, monster.id);
    if (missingFragments === null || !canUnlockDexStoryWithCandy(saveState, monster.id)) {
      return;
    }

    this.showCandyStoryUnlockConfirm(monster, missingFragments);
  }

  /** アメで足りないかけらを補う前に、確認用の小さなモーダルを出します。 */
  private showCandyStoryUnlockConfirm(monster: MonsterDefinition, missingFragments: number): void {
    this.storyUnlockConfirmLayer?.destroy(true);

    const layer = this.add.container(0, 0).setDepth(120);
    this.storyUnlockConfirmLayer = layer;
    const shade = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1f2937, 0.48)
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS.panel).color, 1);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(COLORS.line).color, 1);
    panel.fillRoundedRect(42, 268, 306, 242, 20);
    panel.strokeRoundedRect(42, 268, 306, 242, 20);

    const message = this.add
      .text(
        GAME_WIDTH / 2,
        356,
        `かけらが${missingFragments}こ\nたりないよ。\nアメをつかって\nストーリーをあける？`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: '22px',
          fontStyle: '900',
          color: COLORS.ink,
          align: 'center',
          lineSpacing: 5,
          wordWrap: { width: 264, useAdvancedWrap: true },
        },
      )
      .setOrigin(0.5);
    const yesButton = createButton(this, {
      x: 134,
      y: 462,
      width: 116,
      height: 48,
      label: 'はい',
      fillColor: COLORS.yellow,
      fontSize: 20,
      onClick: () => {
        layer.destroy(true);
        if (this.storyUnlockConfirmLayer === layer) {
          this.storyUnlockConfirmLayer = undefined;
        }
        if (unlockDexStory(monster.id, true)) {
          this.finishStoryUnlock('アメをつかって\nお話をひらいたよ！');
        }
      },
    });
    const noButton = createButton(this, {
      x: 256,
      y: 462,
      width: 116,
      height: 48,
      label: 'いいえ',
      fillColor: COLORS.panel,
      textColor: COLORS.ink,
      fontSize: 20,
      onClick: () => {
        layer.destroy(true);
        if (this.storyUnlockConfirmLayer === layer) {
          this.storyUnlockConfirmLayer = undefined;
        }
      },
    });

    layer.add([shade, panel, message, yesButton, noButton]);
  }

  /** 図鑑ストーリー解放後の音、案内、再描画をまとめます。 */
  private finishStoryUnlock(message: string): void {
    playExchangeSound();
    this.conversionMessage = message;
    this.redrawResultView();
  }

  /** 進化で解放されたモンスターに、輪と拡大アニメーションを付けます。 */
  private playEvolutionUnlockPulse(
    x: number,
    y: number,
    monster: MonsterDefinition,
    circle: Phaser.GameObjects.Arc,
    visual: Phaser.GameObjects.Image,
  ): void {
    const ring = this.add
      .circle(x, y, 31, Phaser.Display.Color.HexStringToColor(monster.palette.accent).color, 0)
      .setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(COLORS.yellow).color, 0.9);
    this.tweens.add({
      targets: ring,
      scale: 1.26,
      alpha: 0,
      repeat: 2,
      duration: 520,
      ease: 'Sine.easeOut',
      onRepeat: () => {
        ring.setScale(1);
        ring.setAlpha(1);
      },
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: [circle, visual],
      scale: 1.12,
      yoyo: true,
      repeat: 2,
      duration: 180,
      ease: 'Sine.easeInOut',
    });
    this.addEvolutionSparkles(x, y, 7, 24);
  }

  /** 進化演出用の小さな星を円形に飛ばします。 */
  private addEvolutionSparkles(x: number, y: number, count: number, radius: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      const startX = x + Math.cos(angle) * (radius - 6);
      const startY = y + Math.sin(angle) * (radius - 6);
      const sparkle = this.add
        .text(startX, startY, '✦', {
          fontFamily: FONT_FAMILY,
          fontSize: index % 2 === 0 ? '15px' : '12px',
          fontStyle: '900',
          color: COLORS.yellow,
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * (radius + 14),
        y: y + Math.sin(angle) * (radius + 14),
        alpha: { from: 0, to: 1 },
        scale: { from: 0.5, to: 1.25 },
        yoyo: true,
        duration: 560,
        delay: index * 38,
        ease: 'Sine.easeOut',
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  /** 進化元まで戻ってから、進化先の最後まで一列に並べた配列を作ります。 */
  private getEvolutionLine(sourceMonster: MonsterDefinition): MonsterDefinition[] {
    let firstMonster = sourceMonster;
    while (firstMonster.previousEvolutionId) {
      firstMonster = getMonsterById(firstMonster.previousEvolutionId);
    }

    const line = [firstMonster];
    let currentMonster = firstMonster;
    while (currentMonster.nextEvolutionId) {
      currentMonster = getMonsterById(currentMonster.nextEvolutionId);
      line.push(currentMonster);
    }

    return line;
  }

  /** 進化、アメ変換、同じステージ、なかまよび、ステージ選たくのボタンを出し分けます。 */
  private drawFooter(evolutionOption: ResultEvolutionOption): void {
    const sourceMonster = evolutionOption.sourceMonster;
    const canStartFragmentEvolution = evolutionOption.evolution.canEvolve
      && sourceMonster.nextEvolutionId !== null
      && !evolutionOption.isEvolutionTargetRegistered;
    const canStartEvolution = canStartFragmentEvolution;
    const canConvertFragmentsToCandy = !canStartEvolution && this.canSuggestCandyConversion(evolutionOption);
    const hasPrimaryAction = canStartEvolution || canConvertFragmentsToCandy;
    const saveState = loadSaveState();
    const playLimitStatus = getStagePlayLimitStatus(saveState, this.stage.id);
    const nakamaCallCount = getItemCount(saveState, SHOP_ITEM_IDS.nakamaCall);
    const shouldShowNakamaCallButton = this.isCurrentMonsterInStage() && nakamaCallCount > 0;
    const sameStageButtonY = hasPrimaryAction ? 662 : 628;
    const gaugeY = sameStageButtonY + 48;
    const stageSelectButtonY = hasPrimaryAction ? 754 : 736;
    if (canStartEvolution) {
      createButton(this, {
        x: GAME_WIDTH / 2,
        y: 590,
        width: 210,
        height: 58,
        label: this.evolvedFromMonsterId
            ? 'さらに\nしんかする'
            : sourceMonster.id !== this.monsterId
              ? `${sourceMonster.name}を\nしんかする`
              : 'しんかする',
        fontSize: 19,
        fillColor: COLORS.yellow,
        onClick: () => this.scene.start(SceneKeys.Evolution, {
          stageId: this.stageId,
          monsterId: sourceMonster.id,
          captureCount: sourceMonster.id === this.monsterId ? this.latestCaptureCount ?? undefined : undefined,
        }),
      });
    } else if (canConvertFragmentsToCandy) {
      createButton(this, {
        x: GAME_WIDTH / 2,
        y: 590,
        width: 210,
        height: 58,
        label: `${sourceMonster.elementName}アメに\nする`,
        fontSize: 18,
        fillColor: COLORS.yellow,
        onClick: () => this.convertFragmentsToCandy(evolutionOption),
      });
    }

    if (shouldShowNakamaCallButton) {
      createButton(this, {
        x: 112,
        y: sameStageButtonY,
        width: 154,
        height: 66,
        label: playLimitStatus.isLimited ? '休けい中' : 'おなじ\nステージ',
        fillColor: this.stage.accentColor,
        fontSize: 18,
        disabled: playLimitStatus.isLimited,
        onClick: () => this.startSameStageCapture(),
      });
      createButton(this, {
        x: 278,
        y: sameStageButtonY,
        width: 154,
        height: 66,
        label: playLimitStatus.isLimited ? '休けい中' : `なかまよび\n${nakamaCallCount}こ`,
        fillColor: '#b9a7ff',
        fontSize: 18,
        disabled: playLimitStatus.isLimited,
        onClick: () => this.startNakamaCallCapture(),
      });
    } else {
      createButton(this, {
        x: GAME_WIDTH / 2,
        y: sameStageButtonY,
        width: 250,
        height: 66,
        label: playLimitStatus.isLimited ? 'このステージは\n休けいちゅう' : 'おなじステージへ',
        fillColor: this.stage.accentColor,
        fontSize: playLimitStatus.isLimited ? 20 : 22,
        disabled: playLimitStatus.isLimited,
        onClick: () => this.startSameStageCapture(),
      });
    }

    if (!this.stage.playLimitDisabled) {
      drawStagePlayLimitGauge(this, GAME_WIDTH / 2, gaugeY, () => getStagePlayLimitStatus(loadSaveState(), this.stage.id), {
        fillColor: this.stage.accentColor,
        squareSize: 10,
        gap: 3,
        fontSize: 14,
      });
      if (playLimitStatus.isLimited) {
        scheduleStagePlayLimitRefresh(this, () => getStagePlayLimitStatus(loadSaveState(), this.stage.id), () => {
          this.redrawResultView();
        });
      }
    }

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: stageSelectButtonY,
      width: 250,
      height: 58,
      label: 'ちがうステージへ',
      fillColor: COLORS.panel,
      fontSize: 19,
      onClick: () => this.scene.start(SceneKeys.StageSelect, { openCategoryList: true }),
    });
  }

  /** 今表示しているモンスターが、このステージの出現対象かを調べます。 */
  private isCurrentMonsterInStage(): boolean {
    return this.stage.monsterIds.some((monsterEntry) => getStageMonsterId(monsterEntry) === this.monsterId);
  }

  /** リザルトから同じステージの次の捕獲へすぐ入ります。 */
  private startSameStageCapture(): void {
    if (!recordStagePlayEntry(this.stage.id)) {
      this.scene.start(SceneKeys.StageSelect, { stageId: this.stage.id });
      return;
    }

    const monsterId = pickEncounterMonsterId(this.stage.monsterIds, loadSaveState().encounterStreak);
    recordEncounterMonster(monsterId);
    this.scene.start(SceneKeys.CaptureGame, {
      stageId: this.stage.id,
      monsterId,
    });
  }

  /** なかまよびアイテムを使い、同じモンスターを指定して捕獲画面へ進みます。 */
  private startNakamaCallCapture(): void {
    if (!this.isCurrentMonsterInStage()) {
      return;
    }

    if (!recordStagePlayEntryUsingItem(this.stage.id, SHOP_ITEM_IDS.nakamaCall)) {
      this.redrawResultView();
      return;
    }

    recordEncounterMonster(this.monsterId);
    this.scene.start(SceneKeys.CaptureGame, {
      stageId: this.stage.id,
      monsterId: this.monsterId,
    });
  }

  /** 進化が終わったかけらをアメに交換し、結果画面を更新します。 */
  private convertFragmentsToCandy(evolutionOption: ResultEvolutionOption): void {
    if (!this.canSuggestCandyConversion(evolutionOption)) {
      return;
    }

    const sourceMonster = evolutionOption.sourceMonster;
    if (!exchangeFragmentsForCandy(sourceMonster.id, sourceMonster.attribute)) {
      return;
    }

    playExchangeSound();
    this.conversionMessage = `${sourceMonster.elementName}アメにしたよ！`;
    this.redrawResultView();
  }
}
