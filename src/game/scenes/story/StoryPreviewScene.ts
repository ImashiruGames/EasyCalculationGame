import * as Phaser from 'phaser';
import { getMonsterById } from '../../../data/monsters';
import {
  storyCreatorActorChoices,
  StoryCreatorActorChoice,
  storyCreatorMonsterIds,
  storyCreatorTrainerIds,
} from '../../../data/storyCreatorActors';
import {
  cloneStoryCreatorPlacement,
  createDefaultStoryCreatorShape,
  createDefaultStoryCreatorTextBox,
  loadLatestStoryCreatorDraft,
  StoryCreatorActorEffect,
  StoryCreatorActorMotion,
  StoryCreatorDraft,
  StoryCreatorPlacement,
  StoryCreatorSide,
  StoryCreatorSpeaker,
  StoryCreatorTextBox,
  StoryCreatorTextLine,
} from '../../../state/storyCreator';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { playStorySoundEffect, preloadStorySoundEffects } from '../../assets/storySoundEffectAssets';
import { getTrainerImageAsset, preloadTrainerImageAssetsByIds } from '../../assets/trainerImageAssets';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import type { ResultSceneData, StageSceneData } from '../../types';
import { createButton, createSmallButton } from '../../ui/common/button';
import { createRichText } from '../../ui/common/richText';
import { drawStoryShape } from '../../ui/common/storyShape';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';

interface StoryPreviewSceneData {
  draft?: StoryCreatorDraft;
  pageIndex?: number;
  returnPageIndex?: number;
  returnScene?: 'creator' | 'list' | 'dex' | 'stageIntro' | 'result';
  returnDexData?: {
    pageIndex?: number;
    selectedMonsterId?: string;
    showCapturedOnly?: boolean;
  };
  returnStageIntroData?: StageSceneData;
  returnResultData?: ResultSceneData;
  savedName?: string;
}

const DIALOG_Y = 626;
const BACK_PAGE_BUTTON_X = 42;
const BACK_PAGE_BUTTON_Y = DIALOG_Y - 2;
const BACK_PAGE_BUTTON_WIDTH = 42;
const BACK_PAGE_BUTTON_HEIGHT = 30;

/** CSSカラー文字列を、Phaserの描画用数値へ変えます。 */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

export class StoryPreviewScene extends Phaser.Scene {
  private draft: StoryCreatorDraft = loadLatestStoryCreatorDraft();
  private pageIndex = 0;
  private returnPageIndex = 0;
  private returnScene: 'creator' | 'list' | 'dex' | 'stageIntro' | 'result' = 'creator';
  private returnDexData: StoryPreviewSceneData['returnDexData'];
  private returnStageIntroData: StageSceneData | undefined;
  private returnResultData: ResultSceneData | undefined;
  private savedName: string | undefined;
  private lastPlayedSoundPageIndex = -1;
  private activeStorySound?: Phaser.Sound.BaseSound;

  /** Phaserに作ったお話の確認画面を登録します。 */
  constructor() {
    super(SceneKeys.StoryPreview);
  }

  /** 作成画面から渡された下書きと、戻る時のページ位置を受け取ります。 */
  init(data?: StoryPreviewSceneData): void {
    this.draft = data?.draft ? this.cloneDraft(data.draft) : loadLatestStoryCreatorDraft();
    this.pageIndex = Phaser.Math.Clamp(Math.floor(data?.pageIndex ?? 0), 0, this.draft.pages.length - 1);
    this.returnPageIndex = Phaser.Math.Clamp(
      Math.floor(data?.returnPageIndex ?? this.pageIndex),
      0,
      this.draft.pages.length - 1,
    );
    this.returnScene = data?.returnScene ?? 'creator';
    this.returnDexData = data?.returnDexData;
    this.returnStageIntroData = data?.returnStageIntroData;
    this.returnResultData = data?.returnResultData;
    this.savedName = data?.savedName;
    this.lastPlayedSoundPageIndex = -1;
  }

  /** プレビューで使うキャラ画像を読み込みます。 */
  preload(): void {
    preloadTrainerImageAssetsByIds(this, storyCreatorTrainerIds);
    preloadMonsterImageAssetsByIds(this, storyCreatorMonsterIds);
    preloadStorySoundEffects(this);
  }

  /** 現在ページのプレビューを描きます。 */
  create(): void {
    startBgm('home');
    this.cameras.main.setBackgroundColor('#eef8f3');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopActiveStorySound());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.stopActiveStorySound());
    this.redraw();
  }

  /** 画面全体を現在ページに合わせて描き直します。 */
  private redraw(): void {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.drawBackground();
    this.drawAdvanceTapZone();
    this.drawHeader();
    this.drawActors();
    this.drawDialogueWindow();
    this.playCurrentPageSoundEffect();
  }

  /** 現在のページに設定された効果音を、同じページでは重複しないよう一度だけ再生します。 */
  private playCurrentPageSoundEffect(): void {
    if (this.lastPlayedSoundPageIndex === this.pageIndex) {
      return;
    }

    this.lastPlayedSoundPageIndex = this.pageIndex;
    const sound = playStorySoundEffect(this, this.currentPage.soundEffectId);
    this.activeStorySound = sound ?? undefined;
    sound?.once('complete', () => {
      if (this.activeStorySound === sound) {
        this.activeStorySound = undefined;
      }
    });
  }

  /** 現在のページで鳴っているストーリー効果音を止めて、次のページへ持ち越さないようにします。 */
  private stopActiveStorySound(): void {
    const sound = this.activeStorySound;
    this.activeStorySound = undefined;
    if (!sound) {
      return;
    }

    if (sound.isPlaying) {
      sound.stop();
    }
    sound.destroy();
  }

  /** プレビュー用の背景と区切りを描きます。 */
  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#eef8f3'), 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(colorToNumber('#ffffff'), 0.94);
    graphics.fillRect(0, 0, GAME_WIDTH, 92);
    graphics.fillStyle(colorToNumber('#e6f0ff'), 1);
    graphics.fillRect(0, 584, GAME_WIDTH, GAME_HEIGHT - 584);

    graphics.lineStyle(2, colorToNumber('#d6eadf'), 0.62);
    for (let x = 30; x < GAME_WIDTH; x += 54) {
      graphics.lineBetween(x, 104, x, 584);
    }

    graphics.lineStyle(3, colorToNumber('#c7dbec'), 0.82);
    graphics.lineBetween(0, 584, GAME_WIDTH, 584);
  }

  /** ボタン以外の画面タップで、次のページへ進める透明な判定を置きます。 */
  private drawAdvanceTapZone(): void {
    this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-20)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (this.isPointerOnStoryControl(pointer)) {
          return;
        }

        this.advancePage();
      });
  }

  /** 戻るボタンなどの操作エリア上なら、全画面ページ送りを止めます。 */
  private isPointerOnStoryControl(pointer: Phaser.Input.Pointer): boolean {
    if (pointer.y <= 92) {
      return true;
    }

    return this.isPointerOnBackPageButton(pointer);
  }

  /** 前ページボタンの周辺かどうかを調べ、全画面送りの誤反応を防ぎます。 */
  private isPointerOnBackPageButton(pointer: Phaser.Input.Pointer): boolean {
    const hitPadding = 10;
    return pointer.x >= BACK_PAGE_BUTTON_X - BACK_PAGE_BUTTON_WIDTH / 2 - hitPadding
      && pointer.x <= BACK_PAGE_BUTTON_X + BACK_PAGE_BUTTON_WIDTH / 2 + hitPadding
      && pointer.y >= BACK_PAGE_BUTTON_Y - BACK_PAGE_BUTTON_HEIGHT / 2 - hitPadding
      && pointer.y <= BACK_PAGE_BUTTON_Y + BACK_PAGE_BUTTON_HEIGHT / 2 + hitPadding;
  }

  /** 上部の戻るボタンとページ番号を描きます。 */
  private drawHeader(): void {
    createSmallButton(this, 42, 44, '←', () => this.returnToCreator());

    this.add
      .text(162, 36, this.draft.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(162, 64, `${this.pageIndex + 1}/${this.draft.pages.length}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 318,
      y: 44,
      width: 94,
      height: 42,
      label: 'もどる',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 16,
      onClick: () => this.returnToCreator(),
    });
  }

  /** 現在ページに置かれたキャラを描きます。 */
  private drawActors(): void {
    this.currentPage.placements.forEach((placement, index) => this.drawPlacement(placement, index));
  }

  /** ひとつのキャラ配置をプレビュー用に描きます。 */
  private drawPlacement(placement: StoryCreatorPlacement, index: number): void {
    if (placement.kind === 'textBox') {
      this.drawTextBoxPlacement(placement, index);
      return;
    }

    if (placement.kind === 'shape') {
      this.drawShapePlacement(placement, index);
      return;
    }

    const actor = this.getActorChoice(placement.actorId ?? '');
    if (!actor) {
      return;
    }

    this.drawCharacterShadow(placement.x, 558, actor.visualSize * placement.scale * 0.62, 24);
    const visual = this.createActorVisual(actor, placement, index);
    if (!visual) {
      return;
    }

    const effect = placement.effect ?? 'none';
    const effectLayer = this.applyPreviewEffect(visual, effect);
    if (effect !== 'shrink') {
      this.applyMotion(visual, placement.motion);
      if (effectLayer) {
        this.applyMotion(effectLayer, placement.motion);
      }
    }
    if (effect !== 'shrink') {
      this.drawNameTag(placement.x, 574, actor.name, actor.tagColor, 24 + index);
    }
  }

  /** ずけいをプレビュー用にかきます。 */
  private drawShapePlacement(placement: StoryCreatorPlacement, index: number): void {
    drawStoryShape(this, placement, placement.shape ?? createDefaultStoryCreatorShape(), {
      depth: 20 + index,
    });
  }

  /** 解説ボックスをプレビュー用に描きます。 */
  private drawTextBoxPlacement(placement: StoryCreatorPlacement, index: number): void {
    const textBox = placement.textBox ?? createDefaultStoryCreatorTextBox();
    const graphics = this.add.graphics().setDepth(20 + index);
    const boxX = placement.x - textBox.width / 2;
    const boxY = placement.y - textBox.height / 2;
    graphics.fillStyle(colorToNumber(textBox.fillColor), 0.96);
    graphics.lineStyle(3, colorToNumber(textBox.strokeColor), 1);
    graphics.fillRoundedRect(boxX, boxY, textBox.width, textBox.height, 14);
    graphics.strokeRoundedRect(boxX, boxY, textBox.width, textBox.height, 14);

    textBox.lines.forEach((line) => {
      const lineWidth = Math.max(30, textBox.width - 28);
      createRichText(this, this.getTextLineX(placement.x, textBox, line, lineWidth), boxY + 16 + line.y, line.text || ' ', {
        width: lineWidth,
        fontSize: line.fontSize,
        fontStyle: line.bold ? '900' : '700',
        color: line.color,
        align: line.align,
        depth: 21 + index,
      });
    });
  }

  /** 解説ボックス内の行のx座標を、行ぞろえに合わせて計算します。 */
  private getTextLineX(centerX: number, textBox: StoryCreatorTextBox, line: StoryCreatorTextLine, lineWidth: number): number {
    if (line.align === 'center') {
      return centerX - lineWidth / 2 + line.x;
    }

    if (line.align === 'right') {
      return centerX + textBox.width / 2 - 14 - lineWidth + line.x;
    }

    return centerX - textBox.width / 2 + 14 + line.x;
  }

  /** キャラの種類に合わせて画像を作ります。 */
  private createActorVisual(
    actor: StoryCreatorActorChoice,
    placement: StoryCreatorPlacement,
    index: number,
  ): Phaser.GameObjects.Image | null {
    const visualSize = actor.visualSize * placement.scale;
    if (actor.kind === 'monster' && actor.monsterId) {
      const monster = getMonsterById(actor.monsterId);
      const image = createMonsterVisual(
        this,
        monster,
        placement.x,
        placement.y + 18,
        visualSize,
        placement.effect === 'silhouette',
      );
      image.setDepth(20 + index);
      image.setFlipX(placement.flipX);
      return image;
    }

    if (!actor.trainerId) {
      return null;
    }

    const asset = getTrainerImageAsset(actor.trainerId);
    if (!asset || !this.textures.exists(asset.key)) {
      return null;
    }

    return this.add
      .image(placement.x, placement.y, asset.key)
      .setDisplaySize(visualSize, visualSize)
      .setFlipX(placement.flipX)
      .setDepth(20 + index)
      .setTint(placement.effect === 'silhouette' ? colorToNumber('#263143') : 0xffffff);
  }

  /** プレビューで選んだエフェクトをキャラへ付けて、必要なら動く補助レイヤーを返します。 */
  private applyPreviewEffect(
    target: Phaser.GameObjects.Image,
    effect: StoryCreatorActorEffect,
  ): Phaser.GameObjects.Container | null {
    if (effect === 'glow') {
      return this.drawGlowHalo(target.x, target.y, Math.max(target.displayWidth, target.displayHeight) * 0.44, target.depth - 2, true);
    }

    if (effect === 'shrink') {
      this.tweens.add({
        targets: target,
        scaleX: target.scaleX * 0.08,
        scaleY: target.scaleY * 0.08,
        alpha: 0,
        y: target.y + 22,
        duration: 680,
        delay: 120,
        ease: 'Back.easeIn',
      });
    }

    if (effect === 'grow') {
      const baseScaleX = target.scaleX;
      const baseScaleY = target.scaleY;
      target.setScale(baseScaleX * 0.08, baseScaleY * 0.08);
      target.setAlpha(0);
      this.tweens.add({
        targets: target,
        scaleX: baseScaleX,
        scaleY: baseScaleY,
        alpha: 1,
        duration: 640,
        delay: 80,
        ease: 'Back.easeOut',
      });
    }

    return null;
  }

  /** キャラの後ろに光の輪を描き、必要ならふわっと動かします。 */
  private drawGlowHalo(
    x: number,
    y: number,
    radius: number,
    depth: number,
    animated: boolean,
  ): Phaser.GameObjects.Container {
    const layer = this.add.container(x, y).setDepth(depth);
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#fff3a6'), 0.34);
    graphics.fillCircle(0, 0, radius);
    graphics.lineStyle(5, colorToNumber('#fff8cf'), 0.82);
    graphics.strokeCircle(0, 0, radius * 0.78);
    graphics.lineStyle(3, colorToNumber('#ffd45a'), 0.54);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      graphics.lineBetween(
        Math.cos(angle) * radius * 0.92,
        Math.sin(angle) * radius * 0.92,
        Math.cos(angle) * radius * 1.14,
        Math.sin(angle) * radius * 1.14,
      );
    }
    layer.add(graphics);

    if (animated) {
      this.tweens.add({
        targets: layer,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.72,
        duration: 480,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
      });
    }

    return layer;
  }

  /** 下の会話ウィンドウを描きます。 */
  private drawDialogueWindow(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 0.97);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(18, DIALOG_Y, GAME_WIDTH - 36, 188, 20);
    graphics.strokeRoundedRect(18, DIALOG_Y, GAME_WIDTH - 36, 188, 20);
    graphics.fillStyle(colorToNumber('#e6f0ff'), 1);
    graphics.fillRoundedRect(34, DIALOG_Y + 16, 126, 38, 13);

    this.add
      .text(96, DIALOG_Y + 35, this.getSpeakerLabel(this.currentPage.speaker), {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: 112, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    createRichText(this, 40, DIALOG_Y + 68, this.currentPage.text || ' ', {
      width: GAME_WIDTH - 80,
      fontSize: 20,
      fontStyle: '900',
      color: COLORS.ink,
      lineSpacing: 6,
      depth: 1,
    });

    this.drawPageMoveButtons();
  }

  /** 読んでいるストーリーの前後ページへ移動するボタンを描きます。 */
  private drawPageMoveButtons(): void {
    createButton(this, {
      x: BACK_PAGE_BUTTON_X,
      y: BACK_PAGE_BUTTON_Y,
      width: BACK_PAGE_BUTTON_WIDTH,
      height: BACK_PAGE_BUTTON_HEIGHT,
      label: '◀',
      fillColor: COLORS.blue,
      strokeColor: '#9cb5c7',
      fontSize: 18,
      disabled: this.pageIndex <= 0,
      onClick: () => this.backPage(),
    }).setDepth(50);
    if (this.pageIndex <= 0) {
      this.drawDisabledBackPageButtonBlocker();
    }

    // createButton(this, {
    //   x: GAME_WIDTH - 74,
    //   y: DIALOG_Y + 70,
    //   width: 76,
    //   height: 34,
    //   label: this.pageIndex >= this.draft.pages.length - 1 ? 'おわる' : 'つぎ',
    //   fillColor: '#fff1a8',
    //   strokeColor: '#b8941e',
    //   fontSize: 15,
    //   onClick: () => this.advancePage(),
    // }).setDepth(5);
  }

  /** 無効な前ページボタンが、下の全画面送りへタップを通さないようにします。 */
  private drawDisabledBackPageButtonBlocker(): void {
    this.add
      .zone(BACK_PAGE_BUTTON_X, BACK_PAGE_BUTTON_Y, BACK_PAGE_BUTTON_WIDTH + 20, BACK_PAGE_BUTTON_HEIGHT + 20)
      .setInteractive()
      .setDepth(55)
      .on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => event.stopPropagation(),
      );
  }

  /** 配置済みキャラに作成画面と同じ短い動きを付けます。 */
  private applyMotion(
    target: Phaser.GameObjects.Image | Phaser.GameObjects.Container,
    motion: StoryCreatorActorMotion,
  ): void {
    if (motion === 'bounce') {
      this.tweens.add({
        targets: target,
        y: target.y - 10,
        duration: 460,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
      });
      return;
    }

    if (motion === 'sway') {
      this.tweens.add({
        targets: target,
        x: target.x + 10,
        duration: 560,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
      });
      return;
    }

    if (motion === 'twitch') {
      this.applyTwitchMotion(target);
      return;
    }

    if (motion === 'slide') {
      this.applySlideMotion(target);
    }
  }

  /** 配置済みキャラを、びくっと角ばった動きで短く動かします。 */
  private applyTwitchMotion(target: Phaser.GameObjects.Image | Phaser.GameObjects.Container): void {
    const baseX = target.x;
    const baseY = target.y;
    const baseAngle = target.angle;
    this.tweens.add({
      targets: target,
      x: baseX + 8,
      y: baseY - 4,
      angle: baseAngle - 4,
      duration: 70,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: target,
          x: baseX - 6,
          y: baseY + 3,
          angle: baseAngle + 4,
          duration: 80,
          ease: 'Quad.easeInOut',
          onComplete: () => {
            this.tweens.add({
              targets: target,
              x: baseX,
              y: baseY,
              angle: baseAngle,
              duration: 100,
              ease: 'Back.easeOut',
            });
          },
        });
      },
    });
  }

  /** 配置済みキャラを、横へすべらせてから元の位置へ戻します。 */
  private applySlideMotion(target: Phaser.GameObjects.Image | Phaser.GameObjects.Container): void {
    const baseX = target.x;
    this.tweens.add({
      targets: target,
      x: baseX + 30,
      duration: 130,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: target,
          x: baseX,
          duration: 260,
          ease: 'Cubic.easeOut',
        });
      },
    });
  }

  /** キャラの影を描きます。 */
  private drawCharacterShadow(x: number, y: number, width: number, height: number): void {
    const graphics = this.add.graphics().setDepth(3);
    graphics.fillStyle(colorToNumber('#8090a3'), 0.22);
    graphics.fillEllipse(x, y, width, height);
  }

  /** キャラ名の小さな札を描きます。 */
  private drawNameTag(x: number, y: number, label: string, fillColor: string, depth: number): void {
    const graphics = this.add.graphics().setDepth(depth);
    graphics.fillStyle(colorToNumber(fillColor), 1);
    graphics.lineStyle(3, colorToNumber(COLORS.line), 0.88);
    graphics.fillRoundedRect(x - 58, y - 18, 116, 36, 13);
    graphics.strokeRoundedRect(x - 58, y - 18, 116, 36, 13);

    this.add
      .text(x, y, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: 102, useAdvancedWrap: true },
      })
      .setDepth(depth + 1)
      .setOrigin(0.5);
  }

  /** 次のページへ進み、最後なら作成画面へ戻ります。 */
  private advancePage(): void {
    if (this.pageIndex >= this.draft.pages.length - 1) {
      this.returnToCreator();
      return;
    }

    this.stopActiveStorySound();
    this.pageIndex += 1;
    this.redraw();
  }

  /** ひとつ前のページへ戻り、最初のページでは何もしません。 */
  private backPage(): void {
    if (this.pageIndex <= 0) {
      return;
    }

    this.stopActiveStorySound();
    this.pageIndex -= 1;
    this.redraw();
  }

  /** 呼び出し元に合わせて、作成画面・一覧・ずかん・ステージ開始画面のどれかへ戻します。 */
  private returnToCreator(): void {
    this.stopActiveStorySound();
    if (this.returnScene === 'list') {
      this.scene.start(SceneKeys.StoryList);
      return;
    }

    if (this.returnScene === 'dex') {
      this.scene.start(SceneKeys.DexPreview, this.returnDexData);
      return;
    }

    if (this.returnScene === 'stageIntro') {
      this.scene.start(SceneKeys.StageIntro, this.returnStageIntroData);
      return;
    }

    if (this.returnScene === 'result') {
      this.scene.start(SceneKeys.Result, this.returnResultData);
      return;
    }

    this.scene.start(SceneKeys.StoryCreator, {
      draft: this.cloneDraft(this.draft),
      pageIndex: this.returnPageIndex,
      savedName: this.savedName,
    });
  }

  /** actorIdから作成画面用キャラ定義を探します。 */
  private getActorChoice(actorId: string): StoryCreatorActorChoice | undefined {
    return storyCreatorActorChoices.find((actor) => actor.id === actorId);
  }

  /** 話者データをプレビューの名前表示へ変えます。 */
  private getSpeakerLabel(speaker?: StoryCreatorSpeaker): string {
    if (!speaker || speaker.kind === 'narration') {
      return 'ナレーション';
    }

    if (speaker.kind === 'left') {
      return this.getPlacementSpeakerName('left') ?? '左キャラ';
    }

    if (speaker.kind === 'right') {
      return this.getPlacementSpeakerName('right') ?? '右キャラ';
    }

    return this.getActorChoice(speaker.actorId ?? '')?.name ?? '？？？';
  }

  /** 左右どちらかに置かれたキャラ名を返します。 */
  private getPlacementSpeakerName(side: StoryCreatorSide): string | undefined {
    const placement = this.currentPage.placements.find((currentPlacement) => currentPlacement.side === side);
    return placement?.kind === 'actor' ? this.getActorChoice(placement.actorId ?? '')?.name : undefined;
  }

  /** 現在ページを返します。 */
  private get currentPage() {
    return this.draft.pages[this.pageIndex] ?? this.draft.pages[0];
  }

  /** 下書きデータを画面間で安全に渡せるよう複製します。 */
  private cloneDraft(draft: StoryCreatorDraft): StoryCreatorDraft {
    return {
      id: draft.id,
      name: draft.name,
      updatedAt: draft.updatedAt,
      pages: draft.pages.map((page) => ({
        text: page.text,
        speaker: { ...(page.speaker ?? { kind: 'narration' }) },
        placements: page.placements.map((placement) => cloneStoryCreatorPlacement(placement)),
        soundEffectId: page.soundEffectId,
      })),
    };
  }
}
