import * as Phaser from 'phaser';
import { getMonsterById } from '../../../data/monsters';
import {
  storyCreatorActorChoices,
  StoryCreatorActorChoice,
  storyCreatorCharacterChoices,
  storyCreatorMonsterIds,
  storyCreatorTrainerIds,
} from '../../../data/storyCreatorActors';
import { getStorySoundEffectById, storySoundEffects } from '../../../data/storySoundEffects';
import {
  cloneStoryCreatorPage,
  cloneStoryCreatorPlacement,
  createDefaultStoryCreatorPage,
  createDefaultStoryCreatorShape,
  createDefaultStoryCreatorTextBox,
  deleteStoryCreatorSceneTemplate,
  loadLatestStoryCreatorDraft,
  loadStoryCreatorSceneTemplates,
  saveStoryCreatorDraft,
  saveStoryCreatorSceneTemplate,
  StoryCreatorActorEffect,
  StoryCreatorActorMotion,
  StoryCreatorDraft,
  StoryCreatorPage,
  StoryCreatorPlacement,
  StoryCreatorSceneTemplate,
  StoryCreatorSide,
  StoryCreatorSpeaker,
  StoryCreatorShape,
  StoryCreatorShapeLabel,
  StoryCreatorTextAlign,
  StoryCreatorTextBox,
  StoryCreatorTextLine,
} from '../../../state/storyCreator';
import { preloadMonsterImageAssetsByIds } from '../../assets/monsterImageAssets';
import { playStorySoundEffect, preloadStorySoundEffects } from '../../assets/storySoundEffectAssets';
import { getTrainerImageAsset, preloadTrainerImageAssetsByIds } from '../../assets/trainerImageAssets';
import { startBgm } from '../../bgm';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../constants';
import { SceneKeys } from '../../sceneKeys';
import { createButton, createSmallButton } from '../../ui/common/button';
import { createRichText } from '../../ui/common/richText';
import { drawStoryShape, getStoryShapeHitBounds, getStoryShapeLocalBounds } from '../../ui/common/storyShape';
import { createMonsterVisual } from '../../ui/creatures/monsterVisual';

const STAGE_TOP = 92;
const STAGE_BOTTOM = 592;
const DIALOG_Y = 612;
const LEFT_X = 104;
const RIGHT_X = 286;
const DEFAULT_ACTOR_Y = 430;
const STEP = 5;
const SCALE_STEP = 0.1;
const MONSTERS_PER_PICKER_PAGE = 9;
const SPEAKERS_PER_PICKER_PAGE = 9;
const SOUND_EFFECTS_PER_PICKER_PAGE = 9;
const SCENE_TEMPLATES_PER_PAGE = 5;
const MAX_UNDO_SNAPSHOT_COUNT = 30;
const MIN_TEXT_BOX_WIDTH = 96;
const MAX_TEXT_BOX_WIDTH = 300;
const MIN_TEXT_BOX_HEIGHT = 86;
const MAX_TEXT_BOX_HEIGHT = 330;
const TEXT_BOX_FILL_COLORS = ['#ffffff', '#fff1a8', '#e6f0ff', '#c8f0da', '#ffe1df'];
const TEXT_LINE_COLORS = [COLORS.ink, '#b52a24', '#2364aa', '#2f9f61'];
const SHAPE_FILL_COLORS = ['#fff1a8', '#e6f0ff', '#c8f0da', '#ffe1df', '#ffffff'];
const SHAPE_STROKE_COLORS = [COLORS.ink, '#b52a24', '#2364aa', '#2f9f61', '#7d5a21'];

const SIDE_X: Record<StoryCreatorSide, number> = {
  left: LEFT_X,
  right: RIGHT_X,
};

const MOTION_LABELS: Record<StoryCreatorActorMotion, string> = {
  none: 'なし',
  bounce: 'ぴょん',
  sway: 'ゆら',
  twitch: 'ビク',
  slide: 'すべる',
};

const EFFECT_LABELS: Record<StoryCreatorActorEffect, string> = {
  none: 'なし',
  glow: '光',
  shrink: 'しぼむ',
  grow: 'ふくらむ',
  silhouette: 'かげ',
};

const ACTOR_MOTION_OPTIONS: StoryCreatorActorMotion[] = ['none', 'bounce', 'sway', 'twitch', 'slide'];
const ACTOR_EFFECT_OPTIONS: StoryCreatorActorEffect[] = ['none', 'glow', 'shrink', 'grow', 'silhouette'];

interface StoryCreatorSceneData {
  draft?: StoryCreatorDraft;
  pageIndex?: number;
  savedName?: string;
}

interface StoryCreatorUndoSnapshot {
  draft: StoryCreatorDraft;
  pageIndex: number;
  selectedPlacementIndex: number | null;
  selectedTextLineIndex: number;
  selectedShapePointIndex: number;
}

/** CSSカラー文字列を、Phaserの描画用数値へ変えます。 */
function colorToNumber(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

export class StoryCreatorScene extends Phaser.Scene {
  private draft: StoryCreatorDraft = loadLatestStoryCreatorDraft();
  private pageIndex = 0;
  private selectedPlacementIndex: number | null = null;
  private pickerSide: StoryCreatorSide | null = null;
  private pickerMonsterPage = 0;
  private selectedTextLineIndex = 0;
  private selectedShapePointIndex = 0;
  private undoSnapshots: StoryCreatorUndoSnapshot[] = [];
  private sceneTemplates: StoryCreatorSceneTemplate[] = loadStoryCreatorSceneTemplates();
  private templatePickerPage = 0;
  private isTemplatePickerOpen = false;
  private isSpeakerPickerOpen = false;
  private speakerPickerPage = 0;
  private isSoundPickerOpen = false;
  private soundPickerPage = 0;
  private soundPickerSelectedEffectId: string | undefined = undefined;
  private noticeText = '';
  private savedDraftName: string | undefined = this.draft.name;
  private isToolsPanelRaised = false;
  private messageInput?: HTMLTextAreaElement;
  private nameInput?: HTMLInputElement;
  private isNameModalOpen = false;
  private readonly handleWindowResize = (): void => {
    this.positionMessageInput();
    this.positionNameInput();
  };

  /** Phaserに文章クリエイト画面のSceneキーを登録します。 */
  constructor() {
    super(SceneKeys.StoryCreator);
  }

  /** プレビューから戻った時の下書きとページ位置を受け取ります。 */
  init(data?: StoryCreatorSceneData): void {
    this.undoSnapshots = [];
    this.selectedTextLineIndex = 0;
    this.selectedShapePointIndex = 0;
    this.isTemplatePickerOpen = false;
    this.isSoundPickerOpen = false;
    this.soundPickerSelectedEffectId = undefined;
    this.sceneTemplates = loadStoryCreatorSceneTemplates();
    if (data?.draft) {
      this.draft = this.cloneDraft(data.draft);
      this.savedDraftName = data.savedName ?? data.draft.name;
    }

    this.pageIndex = Phaser.Math.Clamp(
      Math.floor(data?.pageIndex ?? this.pageIndex),
      0,
      this.draft.pages.length - 1,
    );
  }

  /** 作成画面で選べるキャラ画像を読み込みます。 */
  preload(): void {
    preloadTrainerImageAssetsByIds(this, storyCreatorTrainerIds);
    preloadMonsterImageAssetsByIds(this, storyCreatorMonsterIds);
    preloadStorySoundEffects(this);
  }

  /** 文章クリエイト画面を初期化して描きます。 */
  create(): void {
    startBgm('home');
    this.pageIndex = Phaser.Math.Clamp(this.pageIndex, 0, this.draft.pages.length - 1);
    this.cameras.main.setBackgroundColor('#eef8f3');
    this.createMessageInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyMessageInput());
    this.redraw();
  }

  /** 画面を作り直して、現在のページと選択状態を反映します。 */
  private redraw(): void {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.drawBackground();
    this.drawHeader();
    this.drawPageControls();
    this.drawStage();
    this.drawDialogueEditor();
    this.drawSelectedTools();
    if (this.pickerSide) {
      this.drawActorPicker(this.pickerSide);
    }
    if (this.isSpeakerPickerOpen) {
      this.drawSpeakerPicker();
    }
    if (this.isSoundPickerOpen) {
      this.drawSoundPicker();
    }
    if (this.isTemplatePickerOpen) {
      this.drawTemplatePicker();
    }
    if (this.isNameModalOpen) {
      this.drawNameModal();
    }
    this.updateMessageInput();
    this.updateNameInput();
  }

  /** 背景と画面の大きな区切りを描きます。 */
  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#eef8f3'), 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(colorToNumber('#ffffff'), 0.94);
    graphics.fillRect(0, 0, GAME_WIDTH, 88);
    graphics.fillStyle(colorToNumber('#e6f0ff'), 1);
    graphics.fillRect(0, DIALOG_Y - 10, GAME_WIDTH, GAME_HEIGHT - DIALOG_Y + 10);

    graphics.lineStyle(2, colorToNumber('#d6eadf'), 0.62);
    for (let x = 30; x < GAME_WIDTH; x += 54) {
      graphics.lineBetween(x, STAGE_TOP, x, STAGE_BOTTOM);
    }

    graphics.lineStyle(3, colorToNumber('#c7dbec'), 0.82);
    graphics.lineBetween(0, STAGE_BOTTOM, GAME_WIDTH, STAGE_BOTTOM);
  }

  /** 上部の戻る、名まえ、保存ボタンを描きます。 */
  private drawHeader(): void {
    createSmallButton(this, 42, 44, '←', () => this.scene.start(SceneKeys.MainMenu));

    this.add
      .text(142, 34, 'お話つくる', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(142, 62, this.draft.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '800',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 240,
      y: 44,
      width: 50,
      height: 42,
      label: 'みる',
      fillColor: '#fff1a8',
      strokeColor: '#b8941e',
      fontSize: 15,
      onClick: () => this.openPreview(),
    });

    createButton(this, {
      x: 294,
      y: 44,
      width: 56,
      height: 42,
      label: '名まえ',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 15,
      onClick: () => this.openNameModal(),
    });

    createButton(this, {
      x: 352,
      y: 44,
      width: 58,
      height: 42,
      label: 'ほぞん',
      fillColor: '#c8f0da',
      strokeColor: '#2f9f61',
      fontSize: 15,
      onClick: () => this.saveDraft(),
    });

    if (this.noticeText) {
      this.add
        .text(GAME_WIDTH / 2, 84, this.noticeText, {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: '900',
          color: '#2f9f61',
        })
        .setOrigin(0.5);
    }
  }

  /** ページ移動とページ追加のボタンを描きます。 */
  private drawPageControls(): void {
    createButton(this, {
      x: 66,
      y: 118,
      width: 76,
      height: 38,
      label: 'まえ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 16,
      disabled: this.pageIndex <= 0,
      onClick: () => this.movePage(-1),
    });

    this.add
      .text(GAME_WIDTH / 2, 118, `ページ ${this.pageIndex + 1}/${this.draft.pages.length}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 324,
      y: 118,
      width: 76,
      height: 38,
      label: 'つぎ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 16,
      onClick: () => this.movePage(1),
    });

    createButton(this, {
      x: 42,
      y: 158,
      width: 54,
      height: 34,
      label: 'シーン',
      fillColor: '#e6f0ff',
      strokeColor: '#47647d',
      fontSize: 13,
      onClick: () => this.openTemplatePicker(),
    });

    createButton(this, {
      x: 100,
      y: 158,
      width: 54,
      height: 34,
      label: this.currentPage.soundEffectId ? '音あり' : '音',
      fillColor: this.currentPage.soundEffectId ? '#fff1a8' : COLORS.panel,
      strokeColor: this.currentPage.soundEffectId ? '#b8941e' : '#47647d',
      fontSize: 13,
      onClick: () => this.openSoundPicker(),
    });

    createButton(this, {
      x: 166,
      y: 158,
      width: 64,
      height: 34,
      label: 'つぎに＋',
      fillColor: '#fff1a8',
      strokeColor: '#b8941e',
      fontSize: 13,
      onClick: () => this.addPage(),
    });

    createButton(this, {
      x: 236,
      y: 158,
      width: 62,
      height: 34,
      label: 'もどす',
      fillColor: this.undoSnapshots.length ? '#c8f0da' : COLORS.panel,
      strokeColor: this.undoSnapshots.length ? '#2f9f61' : '#9cb5c7',
      fontSize: 13,
      disabled: !this.undoSnapshots.length,
      onClick: () => this.undoLastEdit(),
    });

    createButton(this, {
      x: 330,
      y: 158,
      width: 72,
      height: 34,
      label: 'ページけす',
      fillColor: '#ffe1df',
      strokeColor: '#b52a24',
      fontSize: 13,
      onClick: () => this.deleteCurrentPage(),
    });
  }

  /** キャラを置く舞台と左右の追加ボタンを描きます。 */
  private drawStage(): void {
    this.drawSideGuide('left');
    this.drawSideGuide('right');
    this.currentPage.placements.forEach((placement, index) => this.drawPlacement(placement, index));
  }

  /** 左右それぞれの配置ガイドと＋ボタンを描きます。 */
  private drawSideGuide(side: StoryCreatorSide): void {
    const x = SIDE_X[side];
    const graphics = this.add.graphics();
    graphics.setDepth(1);
    graphics.fillStyle(colorToNumber('#ffffff'), 0.46);
    graphics.lineStyle(2, colorToNumber('#9cb5c7'), 0.48);
    graphics.fillRoundedRect(x - 72, 188, 144, 356, 20);
    graphics.strokeRoundedRect(x - 72, 188, 144, 356, 20);

    createButton(this, {
      x,
      y: 220,
      width: 52,
      height: 46,
      label: '＋',
      fillColor: '#ffffff',
      strokeColor: '#47647d',
      fontSize: 24,
      onClick: () => this.openPicker(side),
    }).setDepth(8);
  }

  /** 配置済みのキャラまたは解説を、選択判定込みで描きます。 */
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

    const effectLayer = this.applyEditorEffect(visual, placement.effect ?? 'none');
    this.applyMotion(visual, placement.motion);
    if (effectLayer) {
      this.applyMotion(effectLayer, placement.motion);
    }
    this.drawNameTag(placement.x, 574, actor.name, actor.tagColor, 24 + index);
    this.drawPlacementHitZone(placement, index, actor.visualSize * placement.scale, visual, effectLayer);
    if (this.selectedPlacementIndex === index) {
      this.drawSelectionFrame(placement, actor.visualSize * placement.scale);
    }
  }

  /** ずけいのはいちを、点と線ラベルつきでかきます。 */
  private drawShapePlacement(placement: StoryCreatorPlacement, index: number): void {
    const shape = this.ensureShape(placement);
    const selected = this.selectedPlacementIndex === index;
    const result = drawStoryShape(this, placement, shape, {
      depth: 20 + index,
      showPoints: selected,
      selected,
      selectedPointIndex: this.selectedShapePointIndex,
    });
    this.drawShapeHitZone(placement, index, shape, result.objects);
  }

  /** 配置済みの解説ボックスを、行ごとの文字と選択判定込みで描きます。 */
  private drawTextBoxPlacement(placement: StoryCreatorPlacement, index: number): void {
    const textBox = placement.textBox ?? createDefaultStoryCreatorTextBox();
    const layer = this.add.container(placement.x, placement.y).setDepth(20 + index);
    const graphics = this.add.graphics();
    const boxX = -textBox.width / 2;
    const boxY = -textBox.height / 2;
    graphics.fillStyle(colorToNumber(textBox.fillColor), 0.96);
    graphics.lineStyle(3, colorToNumber(textBox.strokeColor), 1);
    graphics.fillRoundedRect(boxX, boxY, textBox.width, textBox.height, 14);
    graphics.strokeRoundedRect(boxX, boxY, textBox.width, textBox.height, 14);
    layer.add(graphics);

    textBox.lines.forEach((line, lineIndex) => {
      const lineWidth = Math.max(30, textBox.width - 28);
      const textX = this.getTextLineX(0, textBox, line, lineWidth);
      const text = createRichText(this, textX, boxY + 16 + line.y, line.text || ' ', {
        width: lineWidth,
        fontSize: line.fontSize,
        fontStyle: line.bold ? '900' : '700',
        color: line.color,
        align: line.align,
      });
      layer.add(text);
      if (this.selectedPlacementIndex === index && lineIndex === this.selectedTextLineIndex) {
        layer.add(this.createTextLineSelection(text.x, text.y, text.width, text.height));
      }
    });

    if (this.selectedPlacementIndex === index) {
      layer.add(this.createTextBoxSelectionFrame(textBox));
      this.drawTextBoxResizeHandle(placement, textBox);
    }
    this.drawTextBoxHitZone(layer, placement, index, textBox);
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

  /** 選択中の解説行を、薄い黄色の枠で示します。 */
  /** 選んでいる解説行のまわりに出す黄色い枠を作ります。 */
  private createTextLineSelection(x: number, y: number, width: number, height: number): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#fff1a8'), 0.28);
    graphics.lineStyle(2, colorToNumber('#b8941e'), 0.72);
    graphics.fillRoundedRect(x - 4, y - 3, width + 8, height + 6, 7);
    graphics.strokeRoundedRect(x - 4, y - 3, width + 8, height + 6, 7);
    return graphics;
  }

  /** 解説ボックス全体のタップ判定を置きます。 */
  private drawTextBoxHitZone(
    layer: Phaser.GameObjects.Container,
    placement: StoryCreatorPlacement,
    index: number,
    textBox: StoryCreatorTextBox,
  ): void {
    const wasSelected = this.selectedPlacementIndex === index;
    const hitZone = this.add
      .zone(placement.x, placement.y, textBox.width, textBox.height)
      .setInteractive({ useHandCursor: true })
      .setDepth(70)
      .on('pointerdown', () => {
        this.selectedPlacementIndex = index;
        this.selectedTextLineIndex = Phaser.Math.Clamp(this.selectedTextLineIndex, 0, textBox.lines.length - 1);
        this.pickerSide = null;
        this.noticeText = '';
        if (!wasSelected) {
          this.redraw();
        }
      });
    if (wasSelected) {
      this.enableTextBoxDrag(layer, hitZone, placement);
    }
  }

  /** 選択中の解説枠をドラッグで移動できるようにして、離した位置を保存します。 */
  /** ずけいをえらぶためのタップはんいをおきます。 */
  private drawShapeHitZone(
    placement: StoryCreatorPlacement,
    index: number,
    shape: StoryCreatorShape,
    shapeObjects: Phaser.GameObjects.GameObject[],
  ): void {
    const bounds = getStoryShapeHitBounds(placement, shape);
    const wasSelected = this.selectedPlacementIndex === index;
    const hitZone = this.add
      .zone(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width, bounds.height)
      .setInteractive({ useHandCursor: true })
      .setDepth(70)
      .on('pointerdown', () => {
        this.selectedPlacementIndex = index;
        this.selectedShapePointIndex = Phaser.Math.Clamp(this.selectedShapePointIndex, 0, shape.points.length - 1);
        this.selectedTextLineIndex = 0;
        this.pickerSide = null;
        this.noticeText = '';
        if (!wasSelected) {
          this.redraw();
        }
      });
    if (wasSelected) {
      this.enableShapeDrag(hitZone, placement, shape, shapeObjects);
    }
  }

  /** えらんだずけいをドラッグでうごかします。 */
  private enableShapeDrag(
    hitZone: Phaser.GameObjects.Zone,
    placement: StoryCreatorPlacement,
    shape: StoryCreatorShape,
    shapeObjects: Phaser.GameObjects.GameObject[],
  ): void {
    hitZone.input!.draggable = true;
    this.input.setDraggable(hitZone);
    const startPoint = { x: placement.x, y: placement.y };
    let latestPoint = { ...startPoint };
    let undoRecorded = false;
    hitZone.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      latestPoint = this.clampShapePlacementPoint(shape, dragX, dragY);
      if (!undoRecorded) {
        this.recordUndoSnapshot();
        undoRecorded = true;
      }
      const bounds = getStoryShapeHitBounds({ ...placement, x: latestPoint.x, y: latestPoint.y }, shape);
      hitZone.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      shapeObjects.forEach((object) => {
        const movableObject = object as Phaser.GameObjects.GameObject & { setPosition?: (x: number, y: number) => void; x?: number; y?: number };
        movableObject.setPosition?.((movableObject.x ?? 0) + latestPoint.x - placement.x, (movableObject.y ?? 0) + latestPoint.y - placement.y);
      });
      placement.x = latestPoint.x;
      placement.y = latestPoint.y;
    });
    hitZone.on('dragend', () => {
      latestPoint = this.clampShapePlacementPoint(shape, latestPoint.x, latestPoint.y);
      if (Math.round(latestPoint.x) === Math.round(startPoint.x) && Math.round(latestPoint.y) === Math.round(startPoint.y)) {
        return;
      }

      placement.x = latestPoint.x;
      placement.y = latestPoint.y;
      this.noticeText = '';
      this.redraw();
    });
  }

  private enableTextBoxDrag(
    layer: Phaser.GameObjects.Container,
    hitZone: Phaser.GameObjects.Zone,
    placement: StoryCreatorPlacement,
  ): void {
    hitZone.input!.draggable = true;
    this.input.setDraggable(hitZone);
    const textBox = this.ensureTextBox(placement);
    const startPoint = { x: placement.x, y: placement.y };
    hitZone.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      const clampedPoint = this.clampTextBoxPlacementPoint(textBox, dragX, dragY);
      layer.setPosition(clampedPoint.x, clampedPoint.y);
      hitZone.setPosition(clampedPoint.x, clampedPoint.y);
    });
    hitZone.on('dragend', () => {
      const clampedPoint = this.clampTextBoxPlacementPoint(textBox, layer.x, layer.y);
      if (Math.round(clampedPoint.x) === Math.round(startPoint.x) && Math.round(clampedPoint.y) === Math.round(startPoint.y)) {
        return;
      }

      this.recordUndoSnapshot();
      placement.x = clampedPoint.x;
      placement.y = clampedPoint.y;
      this.noticeText = '';
      this.redraw();
    });
  }

  /** 選択中の解説枠の右下に、ドラッグでサイズを変えるつまみを出します。 */
  private drawTextBoxResizeHandle(placement: StoryCreatorPlacement, textBox: StoryCreatorTextBox): void {
    const handleX = placement.x + textBox.width / 2;
    const handleY = placement.y + textBox.height / 2;
    const preview = this.add.graphics().setDepth(73);
    const handle = this.add.graphics().setDepth(74);
    this.drawTextBoxResizePreview(preview, placement, textBox.width, textBox.height);
    this.drawTextBoxResizeHandleGraphics(handle, handleX, handleY);
    const hitZone = this.add
      .zone(handleX, handleY, 36, 36)
      .setInteractive({ useHandCursor: true })
      .setDepth(75);
    this.enableTextBoxResizeDrag(preview, handle, hitZone, placement, textBox);
  }

  /** 解説枠サイズ変更中に見える外枠のプレビューを描き直します。 */
  private drawTextBoxResizePreview(
    graphics: Phaser.GameObjects.Graphics,
    placement: StoryCreatorPlacement,
    width: number,
    height: number,
  ): void {
    graphics.clear();
    graphics.lineStyle(2, colorToNumber('#b8941e'), 0.45);
    graphics.strokeRoundedRect(placement.x - width / 2, placement.y - height / 2, width, height, 14);
  }

  /** 解説枠サイズ変更用の右下のつまみを描き直します。 */
  private drawTextBoxResizeHandleGraphics(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.clear();
    graphics.fillStyle(colorToNumber('#fff1a8'), 1);
    graphics.lineStyle(3, colorToNumber('#b8941e'), 1);
    graphics.fillRoundedRect(x - 10, y - 10, 20, 20, 6);
    graphics.strokeRoundedRect(x - 10, y - 10, 20, 20, 6);
    graphics.lineStyle(2, colorToNumber('#7d2a22'), 0.8);
    graphics.lineBetween(x - 3, y + 5, x + 5, y - 3);
  }

  /** 解説枠右下のつまみをドラッグして、幅と高さを保存します。 */
  private enableTextBoxResizeDrag(
    preview: Phaser.GameObjects.Graphics,
    handle: Phaser.GameObjects.Graphics,
    hitZone: Phaser.GameObjects.Zone,
    placement: StoryCreatorPlacement,
    textBox: StoryCreatorTextBox,
  ): void {
    hitZone.input!.draggable = true;
    this.input.setDraggable(hitZone);
    const startSize = { width: textBox.width, height: textBox.height };
    hitZone.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      const nextSize = this.getTextBoxSizeFromResizeHandle(placement, dragX, dragY);
      const handleX = placement.x + nextSize.width / 2;
      const handleY = placement.y + nextSize.height / 2;
      hitZone.setPosition(handleX, handleY);
      this.drawTextBoxResizePreview(preview, placement, nextSize.width, nextSize.height);
      this.drawTextBoxResizeHandleGraphics(handle, handleX, handleY);
    });
    hitZone.on('dragend', () => {
      const nextSize = this.getTextBoxSizeFromResizeHandle(placement, hitZone.x, hitZone.y);
      if (nextSize.width === startSize.width && nextSize.height === startSize.height) {
        return;
      }

      this.recordUndoSnapshot();
      textBox.width = nextSize.width;
      textBox.height = nextSize.height;
      this.noticeText = '';
      this.redraw();
    });
  }

  /** 右下のつまみの位置から、画面に収まる解説枠サイズを計算します。 */
  private getTextBoxSizeFromResizeHandle(
    placement: StoryCreatorPlacement,
    handleX: number,
    handleY: number,
  ): { width: number; height: number } {
    const maxWidthByPosition = Math.max(
      MIN_TEXT_BOX_WIDTH,
      Math.min(MAX_TEXT_BOX_WIDTH, (GAME_WIDTH - 12 - placement.x) * 2, (placement.x - 12) * 2),
    );
    const maxHeightByPosition = Math.max(
      MIN_TEXT_BOX_HEIGHT,
      Math.min(MAX_TEXT_BOX_HEIGHT, (STAGE_BOTTOM - 8 - placement.y) * 2, (placement.y - STAGE_TOP - 8) * 2),
    );
    return {
      width: Phaser.Math.Clamp(Math.round((handleX - placement.x) * 2), MIN_TEXT_BOX_WIDTH, maxWidthByPosition),
      height: Phaser.Math.Clamp(Math.round((handleY - placement.y) * 2), MIN_TEXT_BOX_HEIGHT, maxHeightByPosition),
    };
  }

  /** 解説枠が画面から大きくはみ出ないように、ドラッグ先の座標を丸めます。 */
  private clampTextBoxPlacementPoint(
    textBox: StoryCreatorTextBox,
    x: number,
    y: number,
  ): { x: number; y: number } {
    const halfWidth = textBox.width / 2;
    const halfHeight = textBox.height / 2;
    return {
      x: Phaser.Math.Clamp(x, halfWidth + 12, GAME_WIDTH - halfWidth - 12),
      y: Phaser.Math.Clamp(y, STAGE_TOP + halfHeight + 8, STAGE_BOTTOM - halfHeight - 8),
    };
  }

  /** 選んでいる解説枠の外側に出す黄色い枠を作ります。 */
  private createTextBoxSelectionFrame(textBox: StoryCreatorTextBox): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    graphics.lineStyle(4, colorToNumber(COLORS.yellow), 1);
    graphics.strokeRoundedRect(
      -textBox.width / 2 - 4,
      -textBox.height / 2 - 4,
      textBox.width + 8,
      textBox.height + 8,
      18,
    );
    return graphics;
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

  /** 作成画面で選んだエフェクトを、編集しやすい見た目でキャラへ付けます。 */
  private applyEditorEffect(
    target: Phaser.GameObjects.Image,
    effect: StoryCreatorActorEffect,
  ): Phaser.GameObjects.Container | null {
    if (effect === 'glow') {
      return this.drawGlowHalo(target.x, target.y, Math.max(target.displayWidth, target.displayHeight) * 0.44, target.depth - 2, false);
    }

    if (effect === 'shrink') {
      target.setAlpha(0.62);
      target.setScale(target.scaleX * 0.86, target.scaleY * 0.86);
    }

    if (effect === 'grow') {
      target.setAlpha(0.9);
      target.setScale(target.scaleX * 1.12, target.scaleY * 1.12);
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

  /** 配置済みキャラのタップ判定とドラッグ移動を置きます。 */
  private drawPlacementHitZone(
    placement: StoryCreatorPlacement,
    index: number,
    visualSize: number,
    visual: Phaser.GameObjects.Image,
    effectLayer: Phaser.GameObjects.Container | null,
  ): void {
    const hitWidth = Math.max(112, visualSize * 0.72);
    const hitHeight = Math.max(154, visualSize * 0.92);
    const hitZone = this.add
      .zone(placement.x, placement.y, hitWidth, hitHeight)
      .setInteractive({ useHandCursor: true })
      .setDepth(70);
    this.enableActorDrag(visual, effectLayer, hitZone, placement, index);
  }

  /** 配置済みキャラをドラッグで移動できるようにして、離した位置を保存します。 */
  private enableActorDrag(
    visual: Phaser.GameObjects.Image,
    effectLayer: Phaser.GameObjects.Container | null,
    hitZone: Phaser.GameObjects.Zone,
    placement: StoryCreatorPlacement,
    index: number,
  ): void {
    hitZone.input!.draggable = true;
    this.input.setDraggable(hitZone);
    const wasSelected = this.selectedPlacementIndex === index;
    const startPoint = { x: placement.x, y: placement.y };
    const visualOffset = { x: visual.x - placement.x, y: visual.y - placement.y };
    const effectOffset = effectLayer
      ? { x: effectLayer.x - placement.x, y: effectLayer.y - placement.y }
      : null;
    let latestPoint = { ...startPoint };
    let didDrag = false;

    hitZone.on('pointerdown', () => {
      this.selectedPlacementIndex = index;
      this.pickerSide = null;
      this.noticeText = '';
    });
    hitZone.on('pointerup', () => {
      if (!didDrag && !wasSelected) {
        this.redraw();
      }
    });
    hitZone.on('dragstart', () => {
      this.tweens.killTweensOf(visual);
      if (effectLayer) {
        this.tweens.killTweensOf(effectLayer);
      }
    });
    hitZone.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      didDrag = true;
      latestPoint = this.clampActorPlacementPoint(dragX, dragY);
      hitZone.setPosition(latestPoint.x, latestPoint.y);
      visual.setPosition(latestPoint.x + visualOffset.x, latestPoint.y + visualOffset.y);
      if (effectLayer && effectOffset) {
        effectLayer.setPosition(latestPoint.x + effectOffset.x, latestPoint.y + effectOffset.y);
      }
    });
    hitZone.on('dragend', () => {
      if (
        Math.round(latestPoint.x) === Math.round(startPoint.x)
        && Math.round(latestPoint.y) === Math.round(startPoint.y)
      ) {
        if (!wasSelected) {
          this.redraw();
        }
        return;
      }

      this.recordUndoSnapshot();
      placement.x = latestPoint.x;
      placement.y = latestPoint.y;
      this.noticeText = '';
      this.redraw();
    });
  }

  /** キャラ配置が舞台から大きくはみ出ないように、ドラッグ先の座標を丸めます。 */
  private clampActorPlacementPoint(x: number, y: number): { x: number; y: number } {
    return {
      x: Phaser.Math.Clamp(x, 24, GAME_WIDTH - 24),
      y: Phaser.Math.Clamp(y, STAGE_TOP + 52, STAGE_BOTTOM - 30),
    };
  }

  /** 選択中キャラの枠を描きます。 */
  /** ずけいが見えるように、はいち先の点を丸めます。 */
  private clampShapePlacementPoint(shape: StoryCreatorShape, x: number, y: number): { x: number; y: number } {
    const bounds = getStoryShapeLocalBounds(shape, 1);
    return {
      x: Phaser.Math.Clamp(x, 18 - bounds.x, GAME_WIDTH - 18 - bounds.x - bounds.width),
      y: Phaser.Math.Clamp(y, STAGE_TOP + 20 - bounds.y, STAGE_BOTTOM - 18 - bounds.y - bounds.height),
    };
  }

  private drawSelectionFrame(placement: StoryCreatorPlacement, visualSize: number): void {
    const frameWidth = Math.max(116, visualSize * 0.76);
    const frameHeight = Math.max(160, visualSize * 0.94);
    const graphics = this.add.graphics().setDepth(42);
    graphics.lineStyle(4, colorToNumber(COLORS.yellow), 1);
    graphics.strokeRoundedRect(
      placement.x - frameWidth / 2,
      placement.y - frameHeight / 2,
      frameWidth,
      frameHeight,
      20,
    );
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

  /** 下のセリフ入力エリアを描きます。 */
  private drawDialogueEditor(): void {
    const selectedTextBox = this.getSelectedTextBoxPlacement();
    const selectedShape = this.getSelectedShapePlacement();
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 0.98);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(18, DIALOG_Y, GAME_WIDTH - 36, 178, 20);
    graphics.strokeRoundedRect(18, DIALOG_Y, GAME_WIDTH - 36, 178, 20);

    createButton(this, {
      x: 98,
      y: DIALOG_Y + 34,
      width: 132,
      height: 38,
      label: selectedTextBox
        ? `行 ${this.selectedTextLineIndex + 1}`
        : selectedShape
          ? `線 ${this.selectedShapePointIndex + 1}`
          : this.getSpeakerLabel(this.currentPage.speaker),
      fillColor: '#e6f0ff',
      strokeColor: '#47647d',
      textColor: COLORS.ink,
      fontSize: 15,
      onClick: selectedTextBox || selectedShape ? undefined : () => this.openSpeakerPicker(),
    }).setDepth(4);

    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.lineStyle(2, colorToNumber('#c7dbec'), 1);
    graphics.fillRoundedRect(36, DIALOG_Y + 58, GAME_WIDTH - 72, 100, 14);
    graphics.strokeRoundedRect(36, DIALOG_Y + 58, GAME_WIDTH - 72, 100, 14);
  }

  /** 選択中キャラの座標と動きを調整するボタンを描きます。 */
  private drawSelectedTools(): void {
    const placement = this.selectedPlacement;
    if (!placement) {
      return;
    }
    const panelOffsetY = this.getSelectedToolsOffsetY();

    if (placement.kind === 'textBox') {
      this.drawTextBoxTools(placement, panelOffsetY);
      return;
    }

    if (placement.kind === 'shape') {
      this.drawShapeTools(placement, panelOffsetY);
      return;
    }

    const graphics = this.add.graphics().setDepth(80);
    graphics.fillStyle(colorToNumber('#ffffff'), 0.96);
    graphics.lineStyle(3, colorToNumber('#9cb5c7'), 1);
    graphics.fillRoundedRect(22, 430 + panelOffsetY, GAME_WIDTH - 44, 174, 18);
    graphics.strokeRoundedRect(22, 430 + panelOffsetY, GAME_WIDTH - 44, 174, 18);

    this.add
      .text(70, 498 + panelOffsetY, `x ${Math.round(placement.x)}  y ${Math.round(placement.y)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);

    this.add
      .text(198, 498 + panelOffsetY, `大きさ ${Math.round(placement.scale * 100)}%`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);

    this.drawNudgeButtons(placement, panelOffsetY);
    this.drawScaleButtons(placement, panelOffsetY);
    this.drawMotionButtons(placement, panelOffsetY);
    this.drawEffectButtons(placement, panelOffsetY);
    this.drawToolsPanelMoveButton(340, 426 + panelOffsetY);

    createButton(this, {
      x: 310,
      y: 462 + panelOffsetY,
      width: 54,
      height: 32,
      label: 'はんてん',
      fillColor: placement.flipX ? '#fff1a8' : COLORS.panel,
      strokeColor: placement.flipX ? '#b8941e' : '#9cb5c7',
      fontSize: 12,
      onClick: () => this.togglePlacementFlip(placement),
    }).setDepth(81);

    createButton(this, {
      x: 364,
      y: 462 + panelOffsetY,
      width: 48,
      height: 32,
      label: '中へ',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 12,
      onClick: () => this.centerPlacement(placement),
    }).setDepth(81);

    createButton(this, {
      x: 328,
      y: 498 + panelOffsetY,
      width: 56,
      height: 34,
      label: 'けす',
      fillColor: '#ffe1df',
      strokeColor: '#b52a24',
      fontSize: 15,
      onClick: () => this.removeSelectedPlacement(),
    }).setDepth(81);
  }

  /** 編集パネルを下に置くか上に逃がすかで、描画Y座標のずれを返します。 */
  private getSelectedToolsOffsetY(): number {
    return this.isToolsPanelRaised ? -300 : 0;
  }

  /** 編集パネルを上下に切り替える小ボタンを描きます。 */
  private drawToolsPanelMoveButton(x: number, y: number): void {
    createButton(this, {
      x,
      y,
      width: 58,
      height: 28,
      label: this.isToolsPanelRaised ? '下へ' : '上へ',
      fillColor: '#fff1a8',
      strokeColor: '#b8941e',
      fontSize: 13,
      onClick: () => this.toggleToolsPanelPosition(),
    }).setDepth(82);
  }

  /** 編集パネルを上側または下側へ移動して、見たい場所を空けます。 */
  private toggleToolsPanelPosition(): void {
    this.isToolsPanelRaised = !this.isToolsPanelRaised;
    this.redraw();
  }

  /** 選択中の解説ボックスと行を調整するボタンを描きます。 */
  private drawTextBoxTools(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    const textBox = this.ensureTextBox(placement);
    const line = this.getSelectedTextLine(placement);
    const graphics = this.add.graphics().setDepth(80);
    graphics.fillStyle(colorToNumber('#ffffff'), 0.96);
    graphics.lineStyle(3, colorToNumber('#9cb5c7'), 1);
    graphics.fillRoundedRect(18, 404 + panelOffsetY, GAME_WIDTH - 36, 202, 18);
    graphics.strokeRoundedRect(18, 404 + panelOffsetY, GAME_WIDTH - 36, 202, 18);

    this.add
      .text(66, 426 + panelOffsetY, `x ${Math.round(placement.x)} y ${Math.round(placement.y)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);

    this.add
      .text(188, 426 + panelOffsetY, `行 ${this.selectedTextLineIndex + 1}/${textBox.lines.length}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);

    this.add
      .text(306, 426 + panelOffsetY, `字 ${line.fontSize}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);

    this.drawToolsPanelMoveButton(350, 426 + panelOffsetY);
    this.drawTextBoxLineButtons(placement, panelOffsetY);
    this.drawTextBoxSizeButtons(placement, panelOffsetY);
    this.drawTextLineMoveButtons(placement, panelOffsetY);
    this.drawTextLineStyleButtons(placement, panelOffsetY);
  }

  /** 解説ボックスの行追加、行移動、削除ボタンを描きます。 */
  private drawTextBoxLineButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    createButton(this, {
      x: 46,
      y: 458 + panelOffsetY,
      width: 48,
      height: 28,
      label: '行＋',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 13,
      onClick: () => this.addTextBoxLine(placement),
    }).setDepth(81);

    createButton(this, {
      x: 98,
      y: 458 + panelOffsetY,
      width: 48,
      height: 28,
      label: '行けす',
      fillColor: '#ffe1df',
      strokeColor: '#b52a24',
      fontSize: 12,
      onClick: () => this.deleteTextBoxLine(placement),
    }).setDepth(81);

    createButton(this, {
      x: 150,
      y: 458 + panelOffsetY,
      width: 48,
      height: 28,
      label: 'まえ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 13,
      onClick: () => this.moveSelectedTextLine(-1),
    }).setDepth(81);

    createButton(this, {
      x: 202,
      y: 458 + panelOffsetY,
      width: 48,
      height: 28,
      label: 'つぎ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 13,
      onClick: () => this.moveSelectedTextLine(1),
    }).setDepth(81);

    createButton(this, {
      x: 270,
      y: 458 + panelOffsetY,
      width: 58,
      height: 28,
      label: 'わく色',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 12,
      onClick: () => this.cycleTextBoxFillColor(placement),
    }).setDepth(81);

    createButton(this, {
      x: 340,
      y: 458 + panelOffsetY,
      width: 52,
      height: 28,
      label: 'けす',
      fillColor: '#ffe1df',
      strokeColor: '#b52a24',
      fontSize: 13,
      onClick: () => this.removeSelectedPlacement(),
    }).setDepth(81);
  }

  /** 解説ボックス自体のサイズ確認と、補助の大小ボタンを描きます。 */
  private drawTextBoxSizeButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    const textBox = this.ensureTextBox(placement);
    this.add
      .text(126, 496 + panelOffsetY, `わく ${Math.round(textBox.width)} x ${Math.round(textBox.height)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);

    createButton(this, {
      x: 254,
      y: 496 + panelOffsetY,
      width: 62,
      height: 30,
      label: 'わく小',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 13,
      onClick: () => this.resizeTextBox(placement, -1),
    }).setDepth(81);

    createButton(this, {
      x: 326,
      y: 496 + panelOffsetY,
      width: 62,
      height: 30,
      label: 'わく大',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 13,
      onClick: () => this.resizeTextBox(placement, 1),
    }).setDepth(81);
  }

  /** 選択中の解説行だけを上下左右に動かすボタンを描きます。 */
  private drawTextLineMoveButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    const buttons: Array<{ label: string; x: number; dx: number; dy: number }> = [
      { label: '行←', x: 52, dx: -STEP, dy: 0 },
      { label: '行→', x: 96, dx: STEP, dy: 0 },
      { label: '行↑', x: 140, dx: 0, dy: -STEP },
      { label: '行↓', x: 184, dx: 0, dy: STEP },
    ];
    buttons.forEach((button) => {
      createButton(this, {
        x: button.x,
        y: 534 + panelOffsetY,
        width: 40,
        height: 30,
        label: button.label,
        fillColor: COLORS.panel,
        strokeColor: '#47647d',
        fontSize: 12,
        onClick: () => this.nudgeTextLine(placement, button.dx, button.dy),
      }).setDepth(81);
    });
  }

  /** 選択中の解説行の太さ、字の大きさ、色、行ぞろえを変えるボタンを描きます。 */
  private drawTextLineStyleButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    const line = this.getSelectedTextLine(placement);
    createButton(this, {
      x: 236,
      y: 534 + panelOffsetY,
      width: 46,
      height: 30,
      label: '字小',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 12,
      onClick: () => this.resizeTextLine(placement, -1),
    }).setDepth(81);

    createButton(this, {
      x: 288,
      y: 534 + panelOffsetY,
      width: 46,
      height: 30,
      label: '字大',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 12,
      onClick: () => this.resizeTextLine(placement, 1),
    }).setDepth(81);

    createButton(this, {
      x: 342,
      y: 534 + panelOffsetY,
      width: 48,
      height: 30,
      label: '太',
      fillColor: line.bold ? '#fff1a8' : COLORS.panel,
      strokeColor: line.bold ? '#b8941e' : '#47647d',
      fontSize: 14,
      onClick: () => this.toggleTextLineBold(placement),
    }).setDepth(81);

    (['left', 'center', 'right'] as StoryCreatorTextAlign[]).forEach((align, index) => {
      createButton(this, {
        x: 52 + index * 52,
        y: 572 + panelOffsetY,
        width: 46,
        height: 28,
        label: align === 'left' ? '左' : align === 'center' ? '中' : '右',
        fillColor: line.align === align ? '#fff1a8' : COLORS.panel,
        strokeColor: line.align === align ? '#b8941e' : '#47647d',
        fontSize: 13,
        onClick: () => this.setTextLineAlign(placement, align),
      }).setDepth(81);
    });

    createButton(this, {
      x: 220,
      y: 572 + panelOffsetY,
      width: 58,
      height: 28,
      label: '字色',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 12,
      onClick: () => this.cycleTextLineColor(placement),
    }).setDepth(81);

    createButton(this, {
      x: 284,
      y: 572 + panelOffsetY,
      width: 50,
      height: 28,
      label: '中へ',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 13,
      onClick: () => this.centerPlacement(placement),
    }).setDepth(81);
  }

  /** x,y座標を小さく動かすボタンを描きます。 */
  /** えらんだずけいの点、線ラベル、色をかえるボタンをかきます。 */
  private drawShapeTools(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    const shape = this.ensureShape(placement);
    const point = this.getSelectedShapePoint(placement);
    const label = this.getSelectedShapeLabel(placement);
    const graphics = this.add.graphics().setDepth(80);
    graphics.fillStyle(colorToNumber('#ffffff'), 0.96);
    graphics.lineStyle(3, colorToNumber('#9cb5c7'), 1);
    graphics.fillRoundedRect(18, 404 + panelOffsetY, GAME_WIDTH - 36, 202, 18);
    graphics.strokeRoundedRect(18, 404 + panelOffsetY, GAME_WIDTH - 36, 202, 18);

    this.add
      .text(66, 426 + panelOffsetY, `x ${Math.round(placement.x)} y ${Math.round(placement.y)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);

    this.add
      .text(188, 426 + panelOffsetY, `点 ${this.selectedShapePointIndex + 1}/${shape.points.length}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);

    this.add
      .text(304, 426 + panelOffsetY, `線 ${label.from + 1}-${label.to + 1}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);

    this.drawToolsPanelMoveButton(350, 426 + panelOffsetY);
    this.drawShapePointButtons(placement, panelOffsetY);
    this.drawShapePointMoveButtons(placement, panelOffsetY);
    this.drawShapeStyleButtons(placement, panelOffsetY);

    this.add
      .text(126, 496 + panelOffsetY, `点 x ${Math.round(point.x)} y ${Math.round(point.y)}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setDepth(81)
      .setOrigin(0.5);
  }

  /** ずけいの点をふやす、けす、えらぶボタンをかきます。 */
  private drawShapePointButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    const buttons: Array<{ label: string; x: number; onClick: () => void; fillColor?: string; strokeColor?: string }> = [
      { label: '点+', x: 46, onClick: () => this.addShapePoint(placement) },
      { label: '点けす', x: 104, onClick: () => this.deleteShapePoint(placement), fillColor: '#ffe1df', strokeColor: '#b52a24' },
      { label: 'まえ', x: 170, onClick: () => this.moveSelectedShapePoint(-1) },
      { label: 'つぎ', x: 226, onClick: () => this.moveSelectedShapePoint(1) },
      { label: '中へ', x: 286, onClick: () => this.centerPlacement(placement) },
      { label: 'けす', x: 344, onClick: () => this.removeSelectedPlacement(), fillColor: '#ffe1df', strokeColor: '#b52a24' },
    ];
    buttons.forEach((button) => {
      createButton(this, {
        x: button.x,
        y: 458 + panelOffsetY,
        width: button.label === '点けす' ? 58 : 48,
        height: 28,
        label: button.label,
        fillColor: button.fillColor ?? COLORS.panel,
        strokeColor: button.strokeColor ?? '#47647d',
        fontSize: 12,
        onClick: button.onClick,
      }).setDepth(81);
    });
  }

  /** えらんだ点を上下左右にうごかすボタンをかきます。 */
  private drawShapePointMoveButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    const buttons: Array<{ label: string; x: number; dx: number; dy: number }> = [
      { label: '←', x: 206, dx: -STEP, dy: 0 },
      { label: '→', x: 250, dx: STEP, dy: 0 },
      { label: '↑', x: 294, dx: 0, dy: -STEP },
      { label: '↓', x: 338, dx: 0, dy: STEP },
    ];
    buttons.forEach((button) => {
      createButton(this, {
        x: button.x,
        y: 496 + panelOffsetY,
        width: 38,
        height: 30,
        label: button.label,
        fillColor: COLORS.panel,
        strokeColor: '#47647d',
        fontSize: 16,
        onClick: () => this.nudgeShapePoint(placement, button.dx, button.dy),
      }).setDepth(81);
    });
  }

  /** ずけいの色、線ラベルのずれ、とじるかをかえるボタンをかきます。 */
  private drawShapeStyleButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    const shape = this.ensureShape(placement);
    createButton(this, {
      x: 58,
      y: 534 + panelOffsetY,
      width: 62,
      height: 30,
      label: '中いろ',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 12,
      onClick: () => this.cycleShapeFillColor(placement),
    }).setDepth(81);

    createButton(this, {
      x: 128,
      y: 534 + panelOffsetY,
      width: 62,
      height: 30,
      label: '線いろ',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 12,
      onClick: () => this.cycleShapeStrokeColor(placement),
    }).setDepth(81);

    createButton(this, {
      x: 200,
      y: 534 + panelOffsetY,
      width: 58,
      height: 30,
      label: '文↑',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 12,
      onClick: () => this.nudgeShapeLabel(placement, -6),
    }).setDepth(81);

    createButton(this, {
      x: 264,
      y: 534 + panelOffsetY,
      width: 58,
      height: 30,
      label: '文↓',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 12,
      onClick: () => this.nudgeShapeLabel(placement, 6),
    }).setDepth(81);

    createButton(this, {
      x: 334,
      y: 534 + panelOffsetY,
      width: 66,
      height: 30,
      label: 'とじる',
      fillColor: shape.closed ? '#fff1a8' : COLORS.panel,
      strokeColor: shape.closed ? '#b8941e' : '#47647d',
      fontSize: 12,
      onClick: () => this.toggleShapeClosed(placement),
    }).setDepth(81);
  }

  private drawNudgeButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    createButton(this, {
      x: 108,
      y: 538 + panelOffsetY,
      width: 42,
      height: 34,
      label: '←',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 18,
      onClick: () => this.nudgePlacement(placement, -STEP, 0),
    }).setDepth(81);

    createButton(this, {
      x: 154,
      y: 538 + panelOffsetY,
      width: 42,
      height: 34,
      label: '→',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 18,
      onClick: () => this.nudgePlacement(placement, STEP, 0),
    }).setDepth(81);

    createButton(this, {
      x: 200,
      y: 538 + panelOffsetY,
      width: 42,
      height: 34,
      label: '↑',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 18,
      onClick: () => this.nudgePlacement(placement, 0, -STEP),
    }).setDepth(81);

    createButton(this, {
      x: 246,
      y: 538 + panelOffsetY,
      width: 42,
      height: 34,
      label: '↓',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 18,
      onClick: () => this.nudgePlacement(placement, 0, STEP),
    }).setDepth(81);
  }

  /** 選択中キャラの大きさを変えるボタンを描きます。 */
  private drawScaleButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    createButton(this, {
      x: 294,
      y: 538 + panelOffsetY,
      width: 50,
      height: 34,
      label: '小',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 18,
      onClick: () => this.scalePlacement(placement, -SCALE_STEP),
    }).setDepth(81);

    createButton(this, {
      x: 344,
      y: 538 + panelOffsetY,
      width: 50,
      height: 34,
      label: '大',
      fillColor: COLORS.panel,
      strokeColor: '#47647d',
      fontSize: 18,
      onClick: () => this.scalePlacement(placement, SCALE_STEP),
    }).setDepth(81);
  }

  /** キャラごとの動き切り替えボタンを描きます。 */
  private drawMotionButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    ACTOR_MOTION_OPTIONS.forEach((motion, index) => {
      createButton(this, {
        x: 44 + index * 52,
        y: 462 + panelOffsetY,
        width: 48,
        height: 32,
        label: MOTION_LABELS[motion],
        fillColor: placement.motion === motion ? '#fff1a8' : COLORS.panel,
        strokeColor: placement.motion === motion ? '#b8941e' : '#9cb5c7',
        fontSize: 11,
        onClick: () => this.setPlacementMotion(placement, motion),
      }).setDepth(81);
    });
  }

  /** キャラごとのエフェクト切り替えボタンを描きます。 */
  private drawEffectButtons(placement: StoryCreatorPlacement, panelOffsetY: number): void {
    ACTOR_EFFECT_OPTIONS.forEach((effect, index) => {
      createButton(this, {
        x: 62 + index * 66,
        y: 584 + panelOffsetY,
        width: 60,
        height: 30,
        label: EFFECT_LABELS[effect],
        fillColor: (placement.effect ?? 'none') === effect ? '#fff1a8' : COLORS.panel,
        strokeColor: (placement.effect ?? 'none') === effect ? '#b8941e' : '#9cb5c7',
        fontSize: 13,
        onClick: () => this.setPlacementEffect(placement, effect),
      }).setDepth(81);
    });
  }

  /** キャラ選択の重ね画面を描きます。 */
  private drawActorPicker(side: StoryCreatorSide): void {
    const layer = this.add.container(0, 0).setDepth(100);
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x263143, 0.42).setOrigin(0);
    overlay.setInteractive();
    layer.add(overlay);

    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(30, 138, GAME_WIDTH - 60, 548, 22);
    graphics.strokeRoundedRect(30, 138, GAME_WIDTH - 60, 548, 22);
    layer.add(graphics);

    const title = this.add
      .text(GAME_WIDTH / 2, 180, 'おくもの', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
    layer.add(title);

    this.drawTextBoxPickerButton(layer, side);
    this.drawShapePickerButton(layer, side);
    this.drawPersonPickerGroup(layer, 360, side);
    this.drawMonsterPickerGroup(layer, side);

    const closeButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 644,
      width: 142,
      height: 46,
      label: 'とじる',
      fillColor: COLORS.yellow,
      fontSize: 18,
      onClick: () => {
        this.pickerSide = null;
        this.redraw();
      },
    });
    layer.add(closeButton);
  }

  /** 解説ボックスを置くためのボタンを描きます。 */
  private drawTextBoxPickerButton(layer: Phaser.GameObjects.Container, side: StoryCreatorSide): void {
    layer.add(this.add
      .text(58, 230, 'せつめい', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5));

    const button = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 258,
      width: 168,
      height: 42,
      label: 'せつめいをおく',
      fillColor: '#e6f0ff',
      strokeColor: '#47647d',
      fontSize: 16,
      onClick: () => this.addTextBoxToPage(side),
    });
    layer.add(button);
  }

  /** ずけいをおくためのボタンをかきます。 */
  private drawShapePickerButton(layer: Phaser.GameObjects.Container, side: StoryCreatorSide): void {
    const button = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 306,
      width: 168,
      height: 42,
      label: 'ずけいをおく',
      fillColor: '#fff1a8',
      strokeColor: '#b8941e',
      fontSize: 16,
      onClick: () => this.addShapeToPage(side),
    });
    layer.add(button);
  }

  /** 人を選ぶ見出しとボタンを描きます。 */
  private drawPersonPickerGroup(layer: Phaser.GameObjects.Container, y: number, side: StoryCreatorSide): void {
    const heading = this.add
      .text(58, y - 34, '人', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);
    layer.add(heading);

    storyCreatorActorChoices
      .filter((actor) => actor.group === 'person')
      .forEach((actor, index) => {
        const x = 82 + (index % 3) * 104;
        const buttonY = y + Math.floor(index / 3) * 54;
        const button = createButton(this, {
          x,
          y: buttonY,
          width: 94,
          height: 42,
          label: actor.name,
          fillColor: actor.tagColor,
          strokeColor: '#47647d',
          fontSize: 15,
          onClick: () => this.addActorToPage(actor, side),
        });
        layer.add(button);
      });
  }

  /** モンスターをページごとに選ぶボタンを描きます。 */
  private drawMonsterPickerGroup(layer: Phaser.GameObjects.Container, side: StoryCreatorSide): void {
    const pageCount = Math.max(1, Math.ceil(storyCreatorCharacterChoices.length / MONSTERS_PER_PICKER_PAGE));
    this.pickerMonsterPage = Phaser.Math.Clamp(this.pickerMonsterPage, 0, pageCount - 1);
    const startIndex = this.pickerMonsterPage * MONSTERS_PER_PICKER_PAGE;
    const visibleMonsters = storyCreatorCharacterChoices.slice(startIndex, startIndex + MONSTERS_PER_PICKER_PAGE);

    const heading = this.add
      .text(58, 438, 'モンスター', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5);
    layer.add(heading);

    visibleMonsters.forEach((actor, index) => {
      const x = 82 + (index % 3) * 104;
      const buttonY = 468 + Math.floor(index / 3) * 42;
      const button = createButton(this, {
        x,
        y: buttonY,
        width: 94,
        height: 38,
        label: actor.name,
        fillColor: actor.tagColor,
        strokeColor: '#47647d',
        fontSize: 13,
        onClick: () => this.addActorToPage(actor, side),
      });
      layer.add(button);
    });

    this.drawMonsterPickerPageButtons(layer, pageCount);
  }

  /** モンスター選択のページ送りボタンを描きます。 */
  private drawMonsterPickerPageButtons(layer: Phaser.GameObjects.Container, pageCount: number): void {
    const prevButton = createButton(this, {
      x: 94,
      y: 604,
      width: 72,
      height: 34,
      label: 'まえ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 15,
      disabled: this.pickerMonsterPage <= 0,
      onClick: () => this.moveMonsterPickerPage(-1),
    });
    layer.add(prevButton);

    const pageText = this.add
      .text(GAME_WIDTH / 2, 604, `${this.pickerMonsterPage + 1}/${pageCount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5);
    layer.add(pageText);

    const nextButton = createButton(this, {
      x: 296,
      y: 604,
      width: 72,
      height: 34,
      label: 'つぎ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 15,
      disabled: this.pickerMonsterPage >= pageCount - 1,
      onClick: () => this.moveMonsterPickerPage(1),
    });
    layer.add(nextButton);
  }

  /** セリフの話者を選ぶ重ね画面を描きます。 */
  private drawSpeakerPicker(): void {
    const layer = this.add.container(0, 0).setDepth(110);
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x263143, 0.42).setOrigin(0);
    overlay.setInteractive();
    layer.add(overlay);

    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(30, 170, GAME_WIDTH - 60, 430, 22);
    graphics.strokeRoundedRect(30, 170, GAME_WIDTH - 60, 430, 22);
    layer.add(graphics);

    layer.add(this.add
      .text(GAME_WIDTH / 2, 214, 'はなす人', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5));

    this.drawSpeakerMainButtons(layer);
    this.drawSpeakerActorButtons(layer);

    const closeButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 558,
      width: 142,
      height: 46,
      label: 'とじる',
      fillColor: COLORS.yellow,
      fontSize: 18,
      onClick: () => this.closeSpeakerPicker(),
    });
    layer.add(closeButton);
  }

  /** ナレーション、左キャラ、右キャラの話者ボタンを描きます。 */
  private drawSpeakerMainButtons(layer: Phaser.GameObjects.Container): void {
    const speakerButtons: Array<{ label: string; speaker: StoryCreatorSpeaker; x: number }> = [
      { label: 'ナレーション', speaker: { kind: 'narration' }, x: 82 },
      { label: '左キャラ', speaker: { kind: 'left' }, x: 196 },
      { label: '右キャラ', speaker: { kind: 'right' }, x: 310 },
    ];

    speakerButtons.forEach((speakerButton) => {
      const isSelected = this.isSpeakerSelected(speakerButton.speaker);
      const button = createButton(this, {
        x: speakerButton.x,
        y: 272,
        width: 104,
        height: 42,
        label: speakerButton.label,
        fillColor: isSelected ? '#fff1a8' : COLORS.panel,
        strokeColor: isSelected ? '#b8941e' : '#47647d',
        fontSize: 14,
        onClick: () => this.setPageSpeaker(speakerButton.speaker),
      });
      layer.add(button);
    });
  }

  /** その場に出ていないキャラも話者にできるボタンを描きます。 */
  private drawSpeakerActorButtons(layer: Phaser.GameObjects.Container): void {
    const pageCount = Math.max(1, Math.ceil(storyCreatorActorChoices.length / SPEAKERS_PER_PICKER_PAGE));
    this.speakerPickerPage = Phaser.Math.Clamp(this.speakerPickerPage, 0, pageCount - 1);
    const startIndex = this.speakerPickerPage * SPEAKERS_PER_PICKER_PAGE;
    const visibleActors = storyCreatorActorChoices.slice(startIndex, startIndex + SPEAKERS_PER_PICKER_PAGE);

    layer.add(this.add
      .text(58, 326, 'ほか', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0, 0.5));

    visibleActors.forEach((actor, index) => {
      const speaker: StoryCreatorSpeaker = { kind: 'actor', actorId: actor.id };
      const isSelected = this.isSpeakerSelected(speaker);
      const x = 82 + (index % 3) * 104;
      const buttonY = 360 + Math.floor(index / 3) * 48;
      const button = createButton(this, {
        x,
        y: buttonY,
        width: 94,
        height: 38,
        label: actor.name,
        fillColor: isSelected ? '#fff1a8' : actor.tagColor,
        strokeColor: isSelected ? '#b8941e' : '#47647d',
        fontSize: 13,
        onClick: () => this.setPageSpeaker(speaker),
      });
      layer.add(button);
    });

    this.drawSpeakerPickerPageButtons(layer, pageCount);
  }

  /** 話者選択のページ送りボタンを描きます。 */
  private drawSpeakerPickerPageButtons(layer: Phaser.GameObjects.Container, pageCount: number): void {
    const prevButton = createButton(this, {
      x: 94,
      y: 520,
      width: 72,
      height: 34,
      label: 'まえ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 15,
      disabled: this.speakerPickerPage <= 0,
      onClick: () => this.moveSpeakerPickerPage(-1),
    });
    layer.add(prevButton);

    layer.add(this.add
      .text(GAME_WIDTH / 2, 520, `${this.speakerPickerPage + 1}/${pageCount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5));

    const nextButton = createButton(this, {
      x: 296,
      y: 520,
      width: 72,
      height: 34,
      label: 'つぎ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 15,
      disabled: this.speakerPickerPage >= pageCount - 1,
      onClick: () => this.moveSpeakerPickerPage(1),
    });
    layer.add(nextButton);
  }

  /** ページに付ける効果音を選ぶ重ね画面を描きます。 */
  private drawSoundPicker(): void {
    const layer = this.add.container(0, 0).setDepth(114);
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x263143, 0.42).setOrigin(0);
    overlay.setInteractive();
    layer.add(overlay);

    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(30, 150, GAME_WIDTH - 60, 496, 22);
    graphics.strokeRoundedRect(30, 150, GAME_WIDTH - 60, 496, 22);
    layer.add(graphics);

    layer.add(this.add
      .text(GAME_WIDTH / 2, 194, '音をえらぶ', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5));

    const currentEffect = getStorySoundEffectById(this.currentPage.soundEffectId);
    const selectedEffect = getStorySoundEffectById(this.soundPickerSelectedEffectId);
    layer.add(this.add
      .text(GAME_WIDTH / 2, 226, currentEffect ? `いま ${currentEffect.label}` : 'いま なし', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5));

    layer.add(this.add
      .text(GAME_WIDTH / 2, 254, selectedEffect ? `えらんだ ${selectedEffect.label}` : 'えらんだ なし', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5));

    const noneButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 296,
      width: 132,
      height: 38,
      label: 'なし',
      fillColor: this.soundPickerSelectedEffectId ? COLORS.panel : '#fff1a8',
      strokeColor: this.soundPickerSelectedEffectId ? '#9cb5c7' : '#b8941e',
      fontSize: 16,
      onClick: () => this.previewStorySoundEffect(undefined),
    });
    layer.add(noneButton);

    const pageCount = Math.max(1, Math.ceil(storySoundEffects.length / SOUND_EFFECTS_PER_PICKER_PAGE));
    this.soundPickerPage = Phaser.Math.Clamp(this.soundPickerPage, 0, pageCount - 1);
    const startIndex = this.soundPickerPage * SOUND_EFFECTS_PER_PICKER_PAGE;
    const visibleEffects = storySoundEffects.slice(startIndex, startIndex + SOUND_EFFECTS_PER_PICKER_PAGE);

    visibleEffects.forEach((effect, index) => {
      const isSelected = this.soundPickerSelectedEffectId === effect.id;
      const button = createButton(this, {
        x: 82 + (index % 3) * 104,
        y: 354 + Math.floor(index / 3) * 52,
        width: 94,
        height: 38,
        label: effect.label,
        fillColor: isSelected ? '#fff1a8' : COLORS.panel,
        strokeColor: isSelected ? '#b8941e' : '#47647d',
        fontSize: 13,
        onClick: () => this.previewStorySoundEffect(effect.id),
      });
      layer.add(button);
    });

    this.drawSoundPickerPageButtons(layer, pageCount);

    const useButton = createButton(this, {
      x: 128,
      y: 604,
      width: 116,
      height: 44,
      label: 'つかう',
      fillColor: '#fff1a8',
      strokeColor: '#b8941e',
      fontSize: 18,
      onClick: () => this.setPageSoundEffect(this.soundPickerSelectedEffectId),
    });
    layer.add(useButton);

    const closeButton = createButton(this, {
      x: 262,
      y: 604,
      width: 116,
      height: 44,
      label: 'とじる',
      fillColor: COLORS.yellow,
      fontSize: 18,
      onClick: () => this.closeSoundPicker(),
    });
    layer.add(closeButton);
  }

  /** 効果音一覧のページ送りボタンを描きます。 */
  private drawSoundPickerPageButtons(layer: Phaser.GameObjects.Container, pageCount: number): void {
    const prevButton = createButton(this, {
      x: 96,
      y: 548,
      width: 72,
      height: 32,
      label: 'まえ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 14,
      disabled: this.soundPickerPage <= 0,
      onClick: () => this.moveSoundPickerPage(-1),
    });
    layer.add(prevButton);

    layer.add(this.add
      .text(GAME_WIDTH / 2, 548, `${this.soundPickerPage + 1}/${pageCount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5));

    const nextButton = createButton(this, {
      x: 294,
      y: 548,
      width: 72,
      height: 32,
      label: 'つぎ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 14,
      disabled: this.soundPickerPage >= pageCount - 1,
      onClick: () => this.moveSoundPickerPage(1),
    });
    layer.add(nextButton);
  }

  /** 登録済みシーンの保存、呼び出し、削除をまとめる画面を描きます。 */
  private drawTemplatePicker(): void {
    const layer = this.add.container(0, 0).setDepth(116);
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x263143, 0.42).setOrigin(0);
    overlay.setInteractive();
    layer.add(overlay);

    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(28, 132, GAME_WIDTH - 56, 560, 22);
    graphics.strokeRoundedRect(28, 132, GAME_WIDTH - 56, 560, 22);
    layer.add(graphics);

    layer.add(this.add
      .text(GAME_WIDTH / 2, 174, 'シーン', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5));

    const saveButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 226,
      width: 176,
      height: 42,
      label: 'いまをとうろく',
      fillColor: '#c8f0da',
      strokeColor: '#2f9f61',
      fontSize: 16,
      onClick: () => this.saveCurrentPageAsTemplate(),
    });
    layer.add(saveButton);

    const pageCount = Math.max(1, Math.ceil(this.sceneTemplates.length / SCENE_TEMPLATES_PER_PAGE));
    this.templatePickerPage = Phaser.Math.Clamp(this.templatePickerPage, 0, pageCount - 1);
    const startIndex = this.templatePickerPage * SCENE_TEMPLATES_PER_PAGE;
    const visibleTemplates = this.sceneTemplates.slice(startIndex, startIndex + SCENE_TEMPLATES_PER_PAGE);

    if (!visibleTemplates.length) {
      layer.add(this.add
        .text(GAME_WIDTH / 2, 346, 'まだないよ', {
          fontFamily: FONT_FAMILY,
          fontSize: '20px',
          fontStyle: '900',
          color: COLORS.muted,
        })
        .setOrigin(0.5));
    } else {
      visibleTemplates.forEach((template, index) => {
        this.drawTemplateCard(layer, template, 274 + index * 76);
      });
      this.drawTemplatePickerPageButtons(layer, pageCount);
    }

    const closeButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 650,
      width: 142,
      height: 44,
      label: 'とじる',
      fillColor: COLORS.yellow,
      fontSize: 18,
      onClick: () => this.closeTemplatePicker(),
    });
    layer.add(closeButton);
  }

  /** シーンテンプレート一覧のページ送りボタンを描きます。 */
  private drawTemplatePickerPageButtons(layer: Phaser.GameObjects.Container, pageCount: number): void {
    const prevButton = createButton(this, {
      x: 96,
      y: 612,
      width: 72,
      height: 32,
      label: 'まえ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 14,
      disabled: this.templatePickerPage <= 0,
      onClick: () => this.moveTemplatePickerPage(-1),
    });
    layer.add(prevButton);

    layer.add(this.add
      .text(GAME_WIDTH / 2, 612, `${this.templatePickerPage + 1}/${pageCount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: '900',
        color: COLORS.ink,
      })
      .setOrigin(0.5));

    const nextButton = createButton(this, {
      x: 294,
      y: 612,
      width: 72,
      height: 32,
      label: 'つぎ',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 14,
      disabled: this.templatePickerPage >= pageCount - 1,
      onClick: () => this.moveTemplatePickerPage(1),
    });
    layer.add(nextButton);
  }

  /** ひとつのシーンテンプレートカードを描きます。 */
  private drawTemplateCard(layer: Phaser.GameObjects.Container, template: StoryCreatorSceneTemplate, y: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#eef8f3'), 1);
    graphics.lineStyle(2, colorToNumber('#9cb5c7'), 1);
    graphics.fillRoundedRect(48, y, GAME_WIDTH - 96, 62, 14);
    graphics.strokeRoundedRect(48, y, GAME_WIDTH - 96, 62, 14);
    layer.add(graphics);

    layer.add(this.add
      .text(64, y + 18, template.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: '900',
        color: COLORS.ink,
        wordWrap: { width: 118, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5));

    layer.add(this.add
      .text(64, y + 42, this.getPageSnippet(template.page), {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: '800',
        color: COLORS.muted,
        wordWrap: { width: 122, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5));

    const useButton = createButton(this, {
      x: 246,
      y: y + 31,
      width: 58,
      height: 34,
      label: 'よぶ',
      fillColor: '#fff1a8',
      strokeColor: '#b8941e',
      fontSize: 15,
      onClick: () => this.insertTemplatePage(template),
    });
    layer.add(useButton);

    const deleteButton = createButton(this, {
      x: 314,
      y: y + 31,
      width: 54,
      height: 34,
      label: 'けす',
      fillColor: '#ffe1df',
      strokeColor: '#b52a24',
      fontSize: 14,
      onClick: () => this.deleteTemplate(template),
    });
    layer.add(deleteButton);
  }

  /** モンスター選択ページを前後に動かします。 */
  private moveMonsterPickerPage(delta: number): void {
    const pageCount = Math.max(1, Math.ceil(storyCreatorCharacterChoices.length / MONSTERS_PER_PICKER_PAGE));
    this.pickerMonsterPage = Phaser.Math.Clamp(this.pickerMonsterPage + delta, 0, pageCount - 1);
    this.redraw();
  }

  /** 話者選択ページを前後に動かします。 */
  private moveSpeakerPickerPage(delta: number): void {
    const pageCount = Math.max(1, Math.ceil(storyCreatorActorChoices.length / SPEAKERS_PER_PICKER_PAGE));
    this.speakerPickerPage = Phaser.Math.Clamp(this.speakerPickerPage + delta, 0, pageCount - 1);
    this.redraw();
  }

  /** 効果音一覧のページを前後に動かします。 */
  private moveSoundPickerPage(delta: number): void {
    const pageCount = Math.max(1, Math.ceil(storySoundEffects.length / SOUND_EFFECTS_PER_PICKER_PAGE));
    this.soundPickerPage = Phaser.Math.Clamp(this.soundPickerPage + delta, 0, pageCount - 1);
    this.redraw();
  }

  /** シーンテンプレート一覧のページを前後に動かします。 */
  private moveTemplatePickerPage(delta: number): void {
    const pageCount = Math.max(1, Math.ceil(this.sceneTemplates.length / SCENE_TEMPLATES_PER_PAGE));
    this.templatePickerPage = Phaser.Math.Clamp(this.templatePickerPage + delta, 0, pageCount - 1);
    this.redraw();
  }

  /** 配置済みキャラに動きを付けます。 */
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

  /** 文章クリエイトデータを保存して画面へ知らせます。 */
  private saveDraft(): void {
    this.captureMessageInput();
    this.draft = saveStoryCreatorDraft(this.draft, this.savedDraftName);
    this.savedDraftName = this.draft.name;
    this.noticeText = 'ほぞんした';
    this.redraw();
  }

  /** 作ったページをプレビュー画面で確認します。 */
  private openPreview(): void {
    this.captureMessageInput();
    this.scene.start(SceneKeys.StoryPreview, {
      draft: this.cloneDraft(this.draft),
      returnPageIndex: this.pageIndex,
      returnScene: 'creator',
      savedName: this.savedDraftName,
    });
  }

  /** 前後のページへ移ります。 */
  private movePage(delta: number): void {
    this.captureMessageInput();
    if (delta > 0 && this.pageIndex >= this.draft.pages.length - 1) {
      this.addPage();
      return;
    }

    this.pageIndex = Phaser.Math.Clamp(this.pageIndex + delta, 0, this.draft.pages.length - 1);
    this.selectedPlacementIndex = null;
    this.pickerSide = null;
    this.isSpeakerPickerOpen = false;
    this.isTemplatePickerOpen = false;
    this.isSoundPickerOpen = false;
    this.noticeText = '';
    this.redraw();
  }

  /** 現在ページの次に新しいページを差し込み、そのページへ移ります。 */
  private addPage(): void {
    this.captureMessageInput();
    this.recordUndoSnapshot();
    const insertIndex = this.pageIndex + 1;
    this.draft.pages.splice(insertIndex, 0, this.createNextPageFromCurrent());
    this.pageIndex = insertIndex;
    this.selectedPlacementIndex = null;
    this.pickerSide = null;
    this.isSpeakerPickerOpen = false;
    this.isTemplatePickerOpen = false;
    this.isSoundPickerOpen = false;
    this.noticeText = '';
    this.redraw();
  }

  /** 今見ているページを消し、残りがない時は空の1ページに戻します。 */
  private deleteCurrentPage(): void {
    this.captureMessageInput();
    this.recordUndoSnapshot();

    if (this.draft.pages.length <= 1) {
      this.draft.pages = [createDefaultStoryCreatorPage()];
      this.pageIndex = 0;
    } else {
      const nextPageIndex = Math.max(0, this.pageIndex - 1);
      this.draft.pages.splice(this.pageIndex, 1);
      this.pageIndex = Math.min(nextPageIndex, this.draft.pages.length - 1);
    }

    this.selectedPlacementIndex = null;
    this.pickerSide = null;
    this.isSpeakerPickerOpen = false;
    this.isTemplatePickerOpen = false;
    this.isSoundPickerOpen = false;
    this.noticeText = 'ページをけした';
    this.redraw();
  }

  /** 現在の作業状態を、もどす用の履歴に積みます。 */
  private recordUndoSnapshot(): void {
    this.undoSnapshots.push({
      draft: this.cloneDraft(this.draft),
      pageIndex: this.pageIndex,
      selectedPlacementIndex: this.selectedPlacementIndex,
      selectedTextLineIndex: this.selectedTextLineIndex,
      selectedShapePointIndex: this.selectedShapePointIndex,
    });
    if (this.undoSnapshots.length > MAX_UNDO_SNAPSHOT_COUNT) {
      this.undoSnapshots.shift();
    }
  }

  /** 直前の作業状態へ戻します。 */
  private undoLastEdit(): void {
    this.captureMessageInput();
    const snapshot = this.undoSnapshots.pop();
    if (!snapshot) {
      return;
    }

    this.draft = this.cloneDraft(snapshot.draft);
    this.pageIndex = Phaser.Math.Clamp(snapshot.pageIndex, 0, this.draft.pages.length - 1);
    this.selectedPlacementIndex = snapshot.selectedPlacementIndex;
    this.selectedTextLineIndex = snapshot.selectedTextLineIndex;
    this.selectedShapePointIndex = snapshot.selectedShapePointIndex;
    this.normalizeRestoredSelection();
    this.pickerSide = null;
    this.isSpeakerPickerOpen = false;
    this.isTemplatePickerOpen = false;
    this.isSoundPickerOpen = false;
    this.isNameModalOpen = false;
    this.noticeText = 'もどした';
    this.redraw();
  }

  /** 復元したあとの選択中キャラや行番号が、今のページ内に収まるよう整えます。 */
  private normalizeRestoredSelection(): void {
    if (
      this.selectedPlacementIndex !== null
      && (this.selectedPlacementIndex < 0 || this.selectedPlacementIndex >= this.currentPage.placements.length)
    ) {
      this.selectedPlacementIndex = null;
    }

    const selectedPlacement = this.selectedPlacement;
    if (selectedPlacement?.kind === 'textBox') {
      const textBox = this.ensureTextBox(selectedPlacement);
      this.selectedTextLineIndex = Phaser.Math.Clamp(this.selectedTextLineIndex, 0, textBox.lines.length - 1);
      return;
    }

    if (selectedPlacement?.kind === 'shape') {
      const shape = this.ensureShape(selectedPlacement);
      this.selectedShapePointIndex = Phaser.Math.Clamp(this.selectedShapePointIndex, 0, shape.points.length - 1);
      this.selectedTextLineIndex = 0;
      return;
    }

    this.selectedTextLineIndex = 0;
    this.selectedShapePointIndex = 0;
  }

  /** 指定した側のキャラ選択を開きます。 */
  private openPicker(side: StoryCreatorSide): void {
    this.pickerSide = side;
    this.pickerMonsterPage = 0;
    this.isSpeakerPickerOpen = false;
    this.isTemplatePickerOpen = false;
    this.isSoundPickerOpen = false;
    this.selectedPlacementIndex = null;
    this.noticeText = '';
    this.redraw();
  }

  /** 現在のページに付ける効果音の選択画面を開きます。 */
  private openSoundPicker(): void {
    this.captureMessageInput();
    this.isSoundPickerOpen = true;
    this.soundPickerSelectedEffectId = this.currentPage.soundEffectId;
    this.soundPickerPage = 0;
    this.pickerSide = null;
    this.isSpeakerPickerOpen = false;
    this.isTemplatePickerOpen = false;
    this.isNameModalOpen = false;
    this.selectedPlacementIndex = null;
    this.noticeText = '';
    this.redraw();
  }

  /** 効果音の選択画面を閉じます。 */
  private closeSoundPicker(): void {
    this.isSoundPickerOpen = false;
    this.soundPickerSelectedEffectId = undefined;
    this.redraw();
  }

  /** シーンテンプレートの登録と呼び出し画面を開きます。 */
  private openTemplatePicker(): void {
    this.captureMessageInput();
    this.sceneTemplates = loadStoryCreatorSceneTemplates();
    this.templatePickerPage = Phaser.Math.Clamp(
      this.templatePickerPage,
      0,
      Math.max(0, Math.ceil(this.sceneTemplates.length / SCENE_TEMPLATES_PER_PAGE) - 1),
    );
    this.isTemplatePickerOpen = true;
    this.pickerSide = null;
    this.isSpeakerPickerOpen = false;
    this.isNameModalOpen = false;
    this.isSoundPickerOpen = false;
    this.selectedPlacementIndex = null;
    this.noticeText = '';
    this.redraw();
  }

  /** シーンテンプレートの登録と呼び出し画面を閉じます。 */
  private closeTemplatePicker(): void {
    this.isTemplatePickerOpen = false;
    this.redraw();
  }

  /** 今のページをシーンテンプレートとして保存します。 */
  private saveCurrentPageAsTemplate(): void {
    this.captureMessageInput();
    saveStoryCreatorSceneTemplate(this.clonePage(this.currentPage));
    this.sceneTemplates = loadStoryCreatorSceneTemplates();
    this.templatePickerPage = 0;
    this.noticeText = 'シーンをとうろくした';
    this.redraw();
  }

  /** 選んだシーンテンプレートを今のページの次へ差し込みます。 */
  private insertTemplatePage(template: StoryCreatorSceneTemplate): void {
    this.captureMessageInput();
    this.recordUndoSnapshot();
    const insertIndex = this.pageIndex + 1;
    this.draft.pages.splice(insertIndex, 0, cloneStoryCreatorPage(template.page));
    this.pageIndex = insertIndex;
    this.selectedPlacementIndex = null;
    this.selectedTextLineIndex = 0;
    this.pickerSide = null;
    this.isSpeakerPickerOpen = false;
    this.isTemplatePickerOpen = false;
    this.isSoundPickerOpen = false;
    this.noticeText = 'シーンをよんだ';
    this.redraw();
  }

  /** 選んだシーンテンプレートを登録一覧から消します。 */
  private deleteTemplate(template: StoryCreatorSceneTemplate): void {
    this.sceneTemplates = deleteStoryCreatorSceneTemplate(template.id);
    this.templatePickerPage = Phaser.Math.Clamp(
      this.templatePickerPage,
      0,
      Math.max(0, Math.ceil(this.sceneTemplates.length / SCENE_TEMPLATES_PER_PAGE) - 1),
    );
    this.noticeText = 'シーンをけした';
    this.redraw();
  }

  /** セリフ欄の話者選択を開きます。 */
  private openSpeakerPicker(): void {
    this.captureMessageInput();
    this.isSpeakerPickerOpen = true;
    this.speakerPickerPage = 0;
    this.pickerSide = null;
    this.isTemplatePickerOpen = false;
    this.isNameModalOpen = false;
    this.isSoundPickerOpen = false;
    this.selectedPlacementIndex = null;
    this.noticeText = '';
    this.redraw();
  }

  /** セリフ欄の話者選択を閉じます。 */
  private closeSpeakerPicker(): void {
    this.isSpeakerPickerOpen = false;
    this.redraw();
  }

  /** 現在ページの話者を保存します。 */
  private setPageSpeaker(speaker: StoryCreatorSpeaker): void {
    this.recordUndoSnapshot();
    this.currentPage.speaker = { ...speaker };
    this.isSpeakerPickerOpen = false;
    this.noticeText = '';
    this.redraw();
  }

  /** 効果音を選択状態にして、確認用に一度だけ鳴らします。 */
  private previewStorySoundEffect(soundEffectId: string | undefined): void {
    this.soundPickerSelectedEffectId = soundEffectId?.trim() || undefined;
    if (this.soundPickerSelectedEffectId) {
      playStorySoundEffect(this, this.soundPickerSelectedEffectId);
    }
    this.redraw();
  }

  /** 現在のページに付ける効果音IDを保存します。 */
  private setPageSoundEffect(soundEffectId: string | undefined): void {
    this.captureMessageInput();
    const nextSoundEffectId = soundEffectId?.trim() || undefined;
    if (this.currentPage.soundEffectId !== nextSoundEffectId) {
      this.recordUndoSnapshot();
      if (nextSoundEffectId) {
        this.currentPage.soundEffectId = nextSoundEffectId;
      } else {
        delete this.currentPage.soundEffectId;
      }
    }

    this.isSoundPickerOpen = false;
    this.soundPickerSelectedEffectId = undefined;
    this.noticeText = '';
    this.redraw();
  }

  /** 選んだキャラで、同じ側のスロットを入れ替えます。 */
  private addActorToPage(actor: StoryCreatorActorChoice, side: StoryCreatorSide): void {
    this.recordUndoSnapshot();
    const previousPlacement = this.getPlacementForSide(side);
    const placement: StoryCreatorPlacement = {
      kind: 'actor',
      actorId: actor.id,
      side,
      x: previousPlacement?.x ?? SIDE_X[side],
      y: previousPlacement?.y ?? DEFAULT_ACTOR_Y,
      scale: previousPlacement?.scale ?? actor.defaultScale,
      flipX: previousPlacement?.flipX ?? side === 'right',
      motion: previousPlacement?.motion ?? 'none',
      effect: previousPlacement?.effect ?? 'none',
    };

    this.replacePlacementForSide(side, placement);
    this.selectedTextLineIndex = 0;
    this.pickerSide = null;
    this.noticeText = '';
    this.redraw();
  }

  /** 選んだ側に解説ボックスを置き、同じ側の配置を入れ替えます。 */
  private addTextBoxToPage(side: StoryCreatorSide): void {
    this.recordUndoSnapshot();
    const previousPlacement = this.getPlacementForSide(side);
    const previousTextBox = previousPlacement?.kind === 'textBox'
      ? previousPlacement.textBox
      : undefined;
    const placement: StoryCreatorPlacement = {
      kind: 'textBox',
      side,
      x: previousPlacement?.x ?? SIDE_X[side],
      y: previousPlacement?.y ?? 350,
      scale: 1,
      flipX: false,
      motion: 'none',
      effect: 'none',
      textBox: previousTextBox ?? createDefaultStoryCreatorTextBox(),
    };

    this.replacePlacementForSide(side, placement);
    this.selectedTextLineIndex = 0;
    this.pickerSide = null;
    this.noticeText = '';
    this.redraw();
  }

  /** 指定した側の配置を新しい配置で置き換え、選択位置を更新します。 */
  /** えらんだほうにずけいをおき、同じほうのはいちをおきかえます。 */
  private addShapeToPage(side: StoryCreatorSide): void {
    this.recordUndoSnapshot();
    const previousPlacement = this.getPlacementForSide(side);
    const previousShape = previousPlacement?.kind === 'shape'
      ? previousPlacement.shape
      : undefined;
    const placement: StoryCreatorPlacement = {
      kind: 'shape',
      side,
      x: previousPlacement?.x ?? SIDE_X[side],
      y: previousPlacement?.y ?? 338,
      scale: 1,
      flipX: false,
      motion: 'none',
      effect: 'none',
      shape: previousShape
        ? {
          ...previousShape,
          points: previousShape.points.map((point) => ({ ...point })),
          labels: previousShape.labels.map((label) => ({ ...label })),
        }
        : createDefaultStoryCreatorShape(),
    };

    this.replacePlacementForSide(side, placement);
    this.selectedTextLineIndex = 0;
    this.selectedShapePointIndex = 0;
    this.pickerSide = null;
    this.noticeText = '';
    this.redraw();
  }

  private replacePlacementForSide(side: StoryCreatorSide, placement: StoryCreatorPlacement): void {
    const otherPlacements = this.currentPage.placements.filter((currentPlacement) => currentPlacement.side !== side);
    if (side === 'left') {
      this.currentPage.placements = [placement, ...otherPlacements];
      this.selectedPlacementIndex = 0;
      return;
    }

    this.currentPage.placements = [...otherPlacements, placement];
    this.selectedPlacementIndex = this.currentPage.placements.length - 1;
  }

  /** 選択中キャラの座標を少しだけ動かします。 */
  private nudgePlacement(placement: StoryCreatorPlacement, dx: number, dy: number): void {
    this.recordUndoSnapshot();
    const nextPoint = this.clampActorPlacementPoint(placement.x + dx, placement.y + dy);
    placement.x = nextPoint.x;
    placement.y = nextPoint.y;
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中の配置を画面の横中央へ動かします。 */
  private centerPlacement(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    placement.x = GAME_WIDTH / 2;
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中キャラの大きさを小さく、または大きくします。 */
  private scalePlacement(placement: StoryCreatorPlacement, delta: number): void {
    this.recordUndoSnapshot();
    placement.scale = Phaser.Math.Clamp(
      Math.round((placement.scale + delta) * 10) / 10,
      0.5,
      1.6,
    );
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中キャラの動きを変えます。 */
  private setPlacementMotion(placement: StoryCreatorPlacement, motion: StoryCreatorActorMotion): void {
    this.recordUndoSnapshot();
    placement.motion = motion;
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中キャラのエフェクトを変えます。 */
  private setPlacementEffect(placement: StoryCreatorPlacement, effect: StoryCreatorActorEffect): void {
    this.recordUndoSnapshot();
    placement.effect = effect;
    this.noticeText = '';
    this.redraw();
  }

  /** 解説ボックスに新しい行を足し、その行を選択します。 */
  private addTextBoxLine(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    const textBox = this.ensureTextBox(placement);
    const lastLine = textBox.lines[textBox.lines.length - 1];
    textBox.lines.push({
      text: '',
      x: lastLine?.x ?? 0,
      y: (lastLine?.y ?? 0) + 30,
      fontSize: lastLine?.fontSize ?? 18,
      bold: lastLine?.bold ?? false,
      color: lastLine?.color ?? COLORS.ink,
      align: lastLine?.align ?? 'left',
    });
    this.selectedTextLineIndex = textBox.lines.length - 1;
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中の解説行を消し、最低1行は残します。 */
  private deleteTextBoxLine(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    const textBox = this.ensureTextBox(placement);
    if (textBox.lines.length <= 1) {
      textBox.lines[0].text = '';
      this.selectedTextLineIndex = 0;
    } else {
      textBox.lines.splice(this.selectedTextLineIndex, 1);
      this.selectedTextLineIndex = Phaser.Math.Clamp(this.selectedTextLineIndex, 0, textBox.lines.length - 1);
    }

    this.noticeText = '';
    this.redraw();
  }

  /** 選択する解説行を前後に移します。 */
  private moveSelectedTextLine(delta: number): void {
    const placement = this.getSelectedTextBoxPlacement();
    if (!placement) {
      return;
    }

    const textBox = this.ensureTextBox(placement);
    this.selectedTextLineIndex = Phaser.Math.Clamp(this.selectedTextLineIndex + delta, 0, textBox.lines.length - 1);
    this.noticeText = '';
    this.redraw();
  }

  /** 解説ボックスの横幅と高さを少し変えます。 */
  private resizeTextBox(placement: StoryCreatorPlacement, direction: number): void {
    this.recordUndoSnapshot();
    const textBox = this.ensureTextBox(placement);
    textBox.width = Phaser.Math.Clamp(textBox.width + direction * 16, MIN_TEXT_BOX_WIDTH, MAX_TEXT_BOX_WIDTH);
    textBox.height = Phaser.Math.Clamp(textBox.height + direction * 18, MIN_TEXT_BOX_HEIGHT, MAX_TEXT_BOX_HEIGHT);
    const clampedPoint = this.clampTextBoxPlacementPoint(textBox, placement.x, placement.y);
    placement.x = clampedPoint.x;
    placement.y = clampedPoint.y;
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中の解説行だけを少し動かします。 */
  private nudgeTextLine(placement: StoryCreatorPlacement, dx: number, dy: number): void {
    this.recordUndoSnapshot();
    const line = this.getSelectedTextLine(placement);
    line.x = Phaser.Math.Clamp(line.x + dx, -120, 120);
    line.y = Phaser.Math.Clamp(line.y + dy, -10, 280);
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中の解説行の文字サイズを変えます。 */
  private resizeTextLine(placement: StoryCreatorPlacement, direction: number): void {
    this.recordUndoSnapshot();
    const line = this.getSelectedTextLine(placement);
    line.fontSize = Phaser.Math.Clamp(line.fontSize + direction * 2, 10, 42);
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中の解説行の太字を切り替えます。 */
  private toggleTextLineBold(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    const line = this.getSelectedTextLine(placement);
    line.bold = !line.bold;
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中の解説行の左中右ぞろえを保存します。 */
  private setTextLineAlign(placement: StoryCreatorPlacement, align: StoryCreatorTextAlign): void {
    this.recordUndoSnapshot();
    const line = this.getSelectedTextLine(placement);
    line.align = align;
    line.x = 0;
    this.noticeText = '';
    this.redraw();
  }

  /** 解説ボックスの背景色を候補から順に切り替えます。 */
  private cycleTextBoxFillColor(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    const textBox = this.ensureTextBox(placement);
    textBox.fillColor = this.getNextColor(TEXT_BOX_FILL_COLORS, textBox.fillColor);
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中の解説行の文字色を候補から順に切り替えます。 */
  private cycleTextLineColor(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    const line = this.getSelectedTextLine(placement);
    line.color = this.getNextColor(TEXT_LINE_COLORS, line.color);
    this.noticeText = '';
    this.redraw();
  }

  /** 色候補の中から、現在色の次の色を返します。 */
  /** えらんだ点の次に、新しい点をふやします。 */
  private addShapePoint(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    const shape = this.ensureShape(placement);
    const fromIndex = this.selectedShapePointIndex;
    const toIndex = (fromIndex + 1) % shape.points.length;
    const from = shape.points[fromIndex] ?? { x: -40, y: 0 };
    const to = shape.points[toIndex] ?? { x: from.x + 40, y: from.y };
    const insertIndex = fromIndex + 1;
    shape.points.splice(insertIndex, 0, {
      x: Math.round((from.x + to.x) / 2),
      y: Math.round((from.y + to.y) / 2),
    });
    this.shiftShapeLabelsAfterPointInsert(shape, insertIndex);
    this.selectedShapePointIndex = insertIndex;
    this.noticeText = '';
    this.redraw();
  }

  /** えらんだ点をけし、線ラベルの点ばんもそろえます。 */
  private deleteShapePoint(placement: StoryCreatorPlacement): void {
    const shape = this.ensureShape(placement);
    if (shape.points.length <= 2) {
      return;
    }

    this.recordUndoSnapshot();
    const deletedIndex = this.selectedShapePointIndex;
    shape.points.splice(deletedIndex, 1);
    shape.labels = shape.labels
      .filter((label) => label.from !== deletedIndex && label.to !== deletedIndex)
      .map((label) => ({
        ...label,
        from: label.from > deletedIndex ? label.from - 1 : label.from,
        to: label.to > deletedIndex ? label.to - 1 : label.to,
      }));
    this.selectedShapePointIndex = Phaser.Math.Clamp(deletedIndex, 0, shape.points.length - 1);
    this.noticeText = '';
    this.redraw();
  }

  /** えらぶ点を前後にかえます。 */
  private moveSelectedShapePoint(delta: number): void {
    const placement = this.getSelectedShapePlacement();
    if (!placement) {
      return;
    }

    const shape = this.ensureShape(placement);
    this.selectedShapePointIndex = Phaser.Math.Wrap(this.selectedShapePointIndex + delta, 0, shape.points.length);
    this.noticeText = '';
    this.redraw();
  }

  /** えらんだ点を少しうごかします。 */
  private nudgeShapePoint(placement: StoryCreatorPlacement, dx: number, dy: number): void {
    this.recordUndoSnapshot();
    const point = this.getSelectedShapePoint(placement);
    point.x = Phaser.Math.Clamp(point.x + dx, -180, 180);
    point.y = Phaser.Math.Clamp(point.y + dy, -240, 240);
    this.noticeText = '';
    this.redraw();
  }

  /** えらんだ線ラベルのずれをかえます。 */
  private nudgeShapeLabel(placement: StoryCreatorPlacement, delta: number): void {
    this.recordUndoSnapshot();
    const label = this.getSelectedShapeLabel(placement);
    label.offset = Phaser.Math.Clamp(label.offset + delta, -80, 80);
    this.noticeText = '';
    this.redraw();
  }

  /** ずけいの中の色をつぎの色にかえます。 */
  private cycleShapeFillColor(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    const shape = this.ensureShape(placement);
    shape.fillColor = this.getNextColor(SHAPE_FILL_COLORS, shape.fillColor);
    this.noticeText = '';
    this.redraw();
  }

  /** ずけいの線の色をつぎの色にかえます。 */
  private cycleShapeStrokeColor(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    const shape = this.ensureShape(placement);
    shape.strokeColor = this.getNextColor(SHAPE_STROKE_COLORS, shape.strokeColor);
    this.noticeText = '';
    this.redraw();
  }

  /** ずけいをとじるか、あいた線にするかをかえます。 */
  private toggleShapeClosed(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    const shape = this.ensureShape(placement);
    shape.closed = !shape.closed;
    this.noticeText = '';
    this.redraw();
  }

  /** 点をふやした時に、線ラベルの点ばんを後ろへずらします。 */
  private shiftShapeLabelsAfterPointInsert(shape: StoryCreatorShape, insertIndex: number): void {
    shape.labels = shape.labels.map((label) => ({
      ...label,
      from: label.from >= insertIndex ? label.from + 1 : label.from,
      to: label.to >= insertIndex ? label.to + 1 : label.to,
    }));
  }

  private getNextColor(colors: string[], currentColor: string): string {
    const index = colors.indexOf(currentColor);
    return colors[(index + 1 + colors.length) % colors.length] ?? colors[0];
  }

  /** 選択中キャラの左右反転を切り替えます。 */
  private togglePlacementFlip(placement: StoryCreatorPlacement): void {
    this.recordUndoSnapshot();
    placement.flipX = !placement.flipX;
    this.noticeText = '';
    this.redraw();
  }

  /** 選択中キャラを現在ページから消します。 */
  private removeSelectedPlacement(): void {
    if (this.selectedPlacementIndex === null) {
      return;
    }

    this.recordUndoSnapshot();
    this.currentPage.placements.splice(this.selectedPlacementIndex, 1);
    this.selectedPlacementIndex = null;
    this.noticeText = '';
    this.redraw();
  }

  /** actorIdから作成画面用キャラ定義を探します。 */
  private getActorChoice(actorId: string): StoryCreatorActorChoice | undefined {
    return storyCreatorActorChoices.find((actor) => actor.id === actorId);
  }

  /** 話者データを画面に出す名前へ変えます。 */
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

  /** シーンテンプレート一覧に出すページ内容の短い文を返します。 */
  private getPageSnippet(page: StoryCreatorPage): string {
    const firstText = page.text.trim();
    if (firstText) {
      return firstText.slice(0, 22);
    }

    const textBoxLine = page.placements
      .find((placement) => placement.kind === 'textBox')
      ?.textBox
      ?.lines
      .find((line) => line.text.trim())
      ?.text
      .trim() ?? '';

    return textBoxLine ? textBoxLine.slice(0, 22) : '文字なし';
  }

  /** 左右どちらかに置いたキャラ名を返します。 */
  private getPlacementSpeakerName(side: StoryCreatorSide): string | undefined {
    const placement = this.getPlacementForSide(side);
    return placement?.kind === 'actor' ? this.getActorChoice(placement.actorId ?? '')?.name : undefined;
  }

  /** 現在ページの話者と指定した話者が同じか調べます。 */
  private isSpeakerSelected(speaker: StoryCreatorSpeaker): boolean {
    const currentSpeaker = this.currentPage.speaker ?? { kind: 'narration' };
    if (currentSpeaker.kind !== speaker.kind) {
      return false;
    }

    return speaker.kind !== 'actor' || currentSpeaker.actorId === speaker.actorId;
  }

  /** 指定した側に置かれているキャラ配置を返します。 */
  private getPlacementForSide(side: StoryCreatorSide): StoryCreatorPlacement | undefined {
    for (let index = this.currentPage.placements.length - 1; index >= 0; index -= 1) {
      const placement = this.currentPage.placements[index];
      if (placement.side === side) {
        return placement;
      }
    }

    return undefined;
  }

  /** 今のページのキャラ情報を引き継いだ新しいページを作ります。 */
  private createNextPageFromCurrent(): StoryCreatorPage {
    const basePage = createDefaultStoryCreatorPage();
    return {
      ...basePage,
      speaker: { ...(this.currentPage.speaker ?? { kind: 'narration' }) },
      placements: this.currentPage.placements.map((placement) => cloneStoryCreatorPlacement(placement)),
    };
  }

  /** ストーリーの1ページを、解説行まで含めて安全に複製します。 */
  private clonePage(page: StoryCreatorPage): StoryCreatorPage {
    return {
      text: page.text,
      speaker: { ...(page.speaker ?? { kind: 'narration' }) },
      placements: page.placements.map((placement) => cloneStoryCreatorPlacement(placement)),
      soundEffectId: page.soundEffectId,
    };
  }

  /** 下書きデータを画面間で安全に渡せるよう複製します。 */
  private cloneDraft(draft: StoryCreatorDraft): StoryCreatorDraft {
    return {
      id: draft.id,
      name: draft.name,
      updatedAt: draft.updatedAt,
      pages: draft.pages.map((page) => this.clonePage(page)),
    };
  }

  /** 名まえ変更モーダルを開きます。 */
  private openNameModal(): void {
    this.captureMessageInput();
    this.isNameModalOpen = true;
    this.pickerSide = null;
    this.isSpeakerPickerOpen = false;
    this.isTemplatePickerOpen = false;
    this.isSoundPickerOpen = false;
    this.selectedPlacementIndex = null;
    this.noticeText = '';
    this.createNameInput();
    this.redraw();
  }

  /** 名まえ変更モーダルを閉じます。 */
  private closeNameModal(): void {
    this.isNameModalOpen = false;
    this.redraw();
  }

  /** 名まえ入力モーダルを描きます。 */
  private drawNameModal(): void {
    const layer = this.add.container(0, 0).setDepth(120);
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x263143, 0.42).setOrigin(0);
    overlay.setInteractive();
    layer.add(overlay);

    const graphics = this.add.graphics();
    graphics.fillStyle(colorToNumber('#ffffff'), 1);
    graphics.lineStyle(4, colorToNumber(COLORS.line), 1);
    graphics.fillRoundedRect(34, 244, GAME_WIDTH - 68, 252, 22);
    graphics.strokeRoundedRect(34, 244, GAME_WIDTH - 68, 252, 22);
    graphics.fillStyle(colorToNumber('#e6f0ff'), 1);
    graphics.fillRoundedRect(54, 334, GAME_WIDTH - 108, 50, 14);
    layer.add(graphics);

    layer.add(this.add
      .text(GAME_WIDTH / 2, 288, 'ストーリーの名まえを\nきめよう！', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: '900',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5));

    layer.add(this.add
      .text(GAME_WIDTH / 2, 406, '10字まで', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: '900',
        color: COLORS.muted,
      })
      .setOrigin(0.5));

    const cancelButton = createButton(this, {
      x: 116,
      y: 454,
      width: 112,
      height: 44,
      label: 'やめる',
      fillColor: COLORS.panel,
      strokeColor: '#9cb5c7',
      fontSize: 17,
      onClick: () => this.closeNameModal(),
    });
    layer.add(cancelButton);

    const okButton = createButton(this, {
      x: 274,
      y: 454,
      width: 112,
      height: 44,
      label: 'きめる',
      fillColor: '#c8f0da',
      strokeColor: '#2f9f61',
      fontSize: 17,
      onClick: () => this.applyNameFromInput(),
    });
    layer.add(okButton);
  }

  /** 名まえ入力欄の値を下書きへ反映します。 */
  private applyNameFromInput(): void {
    const nextName = this.nameInput?.value.trim().slice(0, 10) ?? '';
    if (!nextName) {
      this.noticeText = '名まえを いれてね';
      this.isNameModalOpen = false;
      this.redraw();
      return;
    }

    if (nextName === this.draft.name) {
      this.isNameModalOpen = false;
      this.noticeText = '';
      this.redraw();
      return;
    }

    this.recordUndoSnapshot();
    this.draft = {
      ...this.draft,
      name: nextName,
    };
    this.isNameModalOpen = false;
    this.noticeText = '';
    this.redraw();
  }

  /** 現在のページを返します。 */
  private get currentPage(): StoryCreatorPage {
    return this.draft.pages[this.pageIndex] ?? this.draft.pages[0];
  }

  /** 選択中の配置データを返します。 */
  private get selectedPlacement(): StoryCreatorPlacement | null {
    if (this.selectedPlacementIndex === null) {
      return null;
    }

    return this.currentPage.placements[this.selectedPlacementIndex] ?? null;
  }

  /** 選択中の配置が解説ボックスなら、その配置を返します。 */
  private getSelectedTextBoxPlacement(): StoryCreatorPlacement | null {
    const placement = this.selectedPlacement;
    return placement?.kind === 'textBox' ? placement : null;
  }

  /** 解説ボックスデータがない配置に初期データを足して返します。 */
  /** えらんでいるはいちがずけいなら、そのはいちをかえします。 */
  private getSelectedShapePlacement(): StoryCreatorPlacement | null {
    const placement = this.selectedPlacement;
    return placement?.kind === 'shape' ? placement : null;
  }

  private ensureTextBox(placement: StoryCreatorPlacement): StoryCreatorTextBox {
    if (!placement.textBox) {
      placement.textBox = createDefaultStoryCreatorTextBox();
    }

    if (!placement.textBox.lines.length) {
      placement.textBox.lines = createDefaultStoryCreatorTextBox().lines;
    }

    this.selectedTextLineIndex = Phaser.Math.Clamp(this.selectedTextLineIndex, 0, placement.textBox.lines.length - 1);
    return placement.textBox;
  }

  /** 選択中の解説行を返します。 */
  /** ずけいデータがない時は、さいしょのずけいを入れてかえします。 */
  private ensureShape(placement: StoryCreatorPlacement): StoryCreatorShape {
    if (!placement.shape) {
      placement.shape = createDefaultStoryCreatorShape();
    }

    if (placement.shape.points.length < 2) {
      placement.shape.points = createDefaultStoryCreatorShape().points;
    }

    this.selectedShapePointIndex = Phaser.Math.Clamp(this.selectedShapePointIndex, 0, placement.shape.points.length - 1);
    return placement.shape;
  }

  private getSelectedTextLine(placement: StoryCreatorPlacement): StoryCreatorTextLine {
    const textBox = this.ensureTextBox(placement);
    return textBox.lines[this.selectedTextLineIndex] ?? textBox.lines[0];
  }

  /** えらんだずけいの点をかえします。 */
  private getSelectedShapePoint(placement: StoryCreatorPlacement): StoryCreatorShape['points'][number] {
    const shape = this.ensureShape(placement);
    return shape.points[this.selectedShapePointIndex] ?? shape.points[0];
  }

  /** えらんだ点から次の点へつながる線ラベルをかえします。 */
  private getSelectedShapeLabel(placement: StoryCreatorPlacement): StoryCreatorShapeLabel {
    const shape = this.ensureShape(placement);
    const from = this.selectedShapePointIndex;
    const to = (from + 1) % shape.points.length;
    let label = shape.labels.find((currentLabel) => currentLabel.from === from && currentLabel.to === to);
    if (!label) {
      label = { from, to, text: '', offset: 22 };
      shape.labels.push(label);
    }

    return label;
  }

  /** セリフ入力用のHTML入力欄を作ります。 */
  private createMessageInput(): void {
    if (this.messageInput) {
      return;
    }

    const input = document.createElement('textarea');
    input.setAttribute('aria-label', 'セリフまたは行');
    input.placeholder = 'セリフを いれてね';
    input.value = this.getMessageInputText();
    input.style.position = 'fixed';
    input.style.zIndex = '20';
    input.style.boxSizing = 'border-box';
    input.style.resize = 'none';
    input.style.outline = 'none';
    input.style.borderStyle = 'solid';
    input.style.borderColor = '#c7dbec';
    input.style.background = '#ffffff';
    input.style.color = COLORS.ink;
    input.style.fontFamily = FONT_FAMILY;
    input.style.fontWeight = '900';
    input.style.lineHeight = '1.45';
    input.style.overflow = 'auto';
    input.style.boxShadow = 'none';
    input.addEventListener('input', () => {
      this.handleMessageInputChange(input.value);
    });

    document.body.appendChild(input);
    window.addEventListener('resize', this.handleWindowResize);
    this.messageInput = input;
  }

  /** HTML入力欄の値と表示位置を現在ページに合わせます。 */
  private updateMessageInput(): void {
    if (!this.messageInput) {
      return;
    }

    const text = this.getMessageInputText();
    if (this.messageInput.value !== text) {
      this.messageInput.value = text;
    }

    this.messageInput.placeholder = this.getSelectedTextBoxPlacement()
      ? '行の文字を いれてね'
      : this.getSelectedShapePlacement()
        ? '線の文を いれてね'
        : 'セリフを いれてね';
    this.messageInput.style.display = this.pickerSide
      || this.isNameModalOpen
      || this.isSpeakerPickerOpen
      || this.isTemplatePickerOpen
      || this.isSoundPickerOpen
      ? 'none'
      : 'block';
    this.positionMessageInput();
  }

  /** HTML入力欄をPhaserキャンバス内のセリフ枠へ重ねます。 */
  private positionMessageInput(): void {
    if (!this.messageInput) {
      return;
    }

    const rect = this.sys.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / GAME_WIDTH;
    const scaleY = rect.height / GAME_HEIGHT;
    const inputX = 42;
    const inputY = DIALOG_Y + 64;
    const inputWidth = GAME_WIDTH - 84;
    const inputHeight = 88;
    const radius = Math.max(8, 12 * Math.min(scaleX, scaleY));

    this.messageInput.style.left = `${rect.left + inputX * scaleX}px`;
    this.messageInput.style.top = `${rect.top + inputY * scaleY}px`;
    this.messageInput.style.width = `${inputWidth * scaleX}px`;
    this.messageInput.style.height = `${inputHeight * scaleY}px`;
    this.messageInput.style.padding = `${8 * scaleY}px ${10 * scaleX}px`;
    this.messageInput.style.borderWidth = `${Math.max(1, 2 * Math.min(scaleX, scaleY))}px`;
    this.messageInput.style.borderRadius = `${radius}px`;
    this.messageInput.style.fontSize = `${Math.max(12, 18 * scaleY)}px`;
  }

  /** HTML入力欄に残っている文字を現在ページへ反映します。 */
  private captureMessageInput(): void {
    if (this.messageInput) {
      this.applyMessageInputValue(this.messageInput.value);
    }
  }

  /** 入力欄の文字変更を履歴に残して、今のページへ反映します。 */
  private handleMessageInputChange(value: string): void {
    if (value === this.getMessageInputText()) {
      return;
    }

    this.recordUndoSnapshot();
    this.applyMessageInputValue(value);
    this.noticeText = '';
  }

  /** 入力欄に出す文字を、セリフまたは選択中の解説行から返します。 */
  private getMessageInputText(): string {
    const selectedTextBox = this.getSelectedTextBoxPlacement();
    if (selectedTextBox) {
      return this.getSelectedTextLine(selectedTextBox).text;
    }

    const selectedShape = this.getSelectedShapePlacement();
    if (selectedShape) {
      return this.getSelectedShapeLabel(selectedShape).text;
    }

    return this.currentPage.text;
  }

  /** 入力欄の文字を、セリフまたは選択中の解説行へ保存します。 */
  private applyMessageInputValue(value: string): void {
    const selectedTextBox = this.getSelectedTextBoxPlacement();
    if (selectedTextBox) {
      this.getSelectedTextLine(selectedTextBox).text = value;
      return;
    }

    const selectedShape = this.getSelectedShapePlacement();
    if (selectedShape) {
      this.getSelectedShapeLabel(selectedShape).text = value;
      return;
    }

    this.currentPage.text = value;
  }

  /** 名まえ入力用のHTML入力欄を作ります。 */
  private createNameInput(): void {
    if (this.nameInput) {
      return;
    }

    const input = document.createElement('input');
    input.setAttribute('aria-label', '名まえ');
    input.maxLength = 10;
    input.value = this.draft.name.slice(0, 10);
    input.style.position = 'fixed';
    input.style.zIndex = '30';
    input.style.boxSizing = 'border-box';
    input.style.outline = 'none';
    input.style.borderStyle = 'solid';
    input.style.borderColor = '#c7dbec';
    input.style.background = '#ffffff';
    input.style.color = COLORS.ink;
    input.style.fontFamily = FONT_FAMILY;
    input.style.fontWeight = '900';
    input.style.textAlign = 'center';
    input.style.boxShadow = 'none';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.applyNameFromInput();
      }
    });

    document.body.appendChild(input);
    this.nameInput = input;
  }

  /** HTML名まえ入力欄の値と表示位置をモーダルへ合わせます。 */
  private updateNameInput(): void {
    if (!this.nameInput) {
      return;
    }

    if (!this.isNameModalOpen) {
      this.nameInput.style.display = 'none';
      return;
    }

    if (document.activeElement !== this.nameInput && this.nameInput.value !== this.draft.name.slice(0, 10)) {
      this.nameInput.value = this.draft.name.slice(0, 10);
    }

    this.nameInput.style.display = 'block';
    this.positionNameInput();
    this.nameInput.focus();
  }

  /** HTML名まえ入力欄をPhaserキャンバス内の名まえ枠へ重ねます。 */
  private positionNameInput(): void {
    if (!this.nameInput) {
      return;
    }

    const rect = this.sys.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / GAME_WIDTH;
    const scaleY = rect.height / GAME_HEIGHT;
    const inputX = 62;
    const inputY = 342;
    const inputWidth = GAME_WIDTH - 124;
    const inputHeight = 36;
    const radius = Math.max(8, 12 * Math.min(scaleX, scaleY));

    this.nameInput.style.left = `${rect.left + inputX * scaleX}px`;
    this.nameInput.style.top = `${rect.top + inputY * scaleY}px`;
    this.nameInput.style.width = `${inputWidth * scaleX}px`;
    this.nameInput.style.height = `${inputHeight * scaleY}px`;
    this.nameInput.style.padding = `${4 * scaleY}px ${10 * scaleX}px`;
    this.nameInput.style.borderWidth = `${Math.max(1, 2 * Math.min(scaleX, scaleY))}px`;
    this.nameInput.style.borderRadius = `${radius}px`;
    this.nameInput.style.fontSize = `${Math.max(14, 19 * scaleY)}px`;
  }

  /** シーン終了時にHTML入力欄を画面から取り除きます。 */
  private destroyMessageInput(): void {
    window.removeEventListener('resize', this.handleWindowResize);
    this.messageInput?.remove();
    this.messageInput = undefined;
    this.nameInput?.remove();
    this.nameInput = undefined;
  }
}
